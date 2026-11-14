import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDB, memoryStore } from '../config/db.js';

export const uploadRecording = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const { meeting_id, title, duration } = req.body;
    const userId = req.user.id;
    const recordingId = uuidv4();
    const filename = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const recordingTitle = title || `Enregistrement Réunion - ${new Date().toLocaleDateString()}`;

    const { pool, isConnected } = getDB();

    if (isConnected && pool) {
      await pool.query(
        `INSERT INTO recordings 
        (id, meeting_id, user_id, title, filename, file_path, file_size, duration, mime_type, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordingId,
          meeting_id || uuidv4(),
          userId,
          recordingTitle,
          filename,
          filePath,
          fileSize,
          parseInt(duration) || 0,
          req.file.mimetype || 'video/webm',
          'ready'
        ]
      );
    } else {
      memoryStore.recordings.push({
        id: recordingId,
        meeting_id: meeting_id || uuidv4(),
        user_id: userId,
        title: recordingTitle,
        filename,
        file_path: filePath,
        file_size: fileSize,
        duration: parseInt(duration) || 0,
        mime_type: req.file.mimetype || 'video/webm',
        status: 'ready',
        created_at: new Date()
      });
    }

    return res.status(201).json({
      message: 'Recording uploaded successfully',
      recording: {
        id: recordingId,
        title: recordingTitle,
        filename,
        duration: parseInt(duration) || 0,
        url: `/uploads/${filename}`
      }
    });
  } catch (error) {
    console.error('Upload recording error:', error);
    return res.status(500).json({ error: 'Failed to save recording' });
  }
};

export const getUserRecordings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pool, isConnected } = getDB();
    let recordings = [];

    if (isConnected && pool) {
      const [rows] = await pool.query(
        `SELECT r.*, m.title as meeting_title, m.code as meeting_code 
         FROM recordings r 
         LEFT JOIN meetings m ON r.meeting_id = m.id 
         WHERE r.user_id = ? 
         ORDER BY r.created_at DESC`,
        [userId]
      );
      recordings = rows;
    } else {
      recordings = memoryStore.recordings
        .filter(r => r.user_id === userId)
        .map(r => {
          const m = memoryStore.meetings.find(meeting => meeting.id === r.meeting_id);
          return {
            ...r,
            meeting_title: m ? m.title : 'Session JT-Meet',
            meeting_code: m ? m.code : 'jt-direct'
          };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return res.json({ recordings });
  } catch (error) {
    console.error('Get recordings error:', error);
    return res.status(500).json({ error: 'Failed to retrieve recordings' });
  }
};

export const getRecordingById = async (req, res) => {
  try {
    const { id } = req.params;
    const { pool, isConnected } = getDB();
    let recording = null;

    if (isConnected && pool) {
      const [rows] = await pool.query('SELECT * FROM recordings WHERE id = ?', [id]);
      if (rows.length > 0) recording = rows[0];
    } else {
      recording = memoryStore.recordings.find(r => r.id === id);
    }

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    return res.json({ recording });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get recording' });
  }
};
