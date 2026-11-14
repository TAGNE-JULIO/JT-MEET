import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDB, memoryStore } from '../config/db.js';
import { trimVideo } from '../utils/videoTrimmer.js';

export const createClip = async (req, res) => {
  try {
    const { recording_id, title, description, start_time, end_time, is_public, password, expires_in_days } = req.body;
    const userId = req.user.id;

    if (!recording_id || start_time === undefined || end_time === undefined) {
      return res.status(400).json({ error: 'recording_id, start_time and end_time are required' });
    }

    const start = Math.max(0, parseFloat(start_time));
    const end = parseFloat(end_time);

    if (end <= start) {
      return res.status(400).json({ error: 'end_time must be strictly greater than start_time' });
    }

    const duration = Math.round(end - start);

    // 1. Retrieve the source recording
    const { pool, isConnected } = getDB();
    let recording = null;

    if (isConnected && pool) {
      const [rows] = await pool.query('SELECT * FROM recordings WHERE id = ?', [recording_id]);
      if (rows.length > 0) recording = rows[0];
    } else {
      recording = memoryStore.recordings.find(r => r.id === recording_id);
    }

    if (!recording) {
      return res.status(404).json({ error: 'Source recording not found' });
    }

    // 2. Prepare output file
    const clipId = uuidv4();
    const uploadsDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(recording.filename) || '.mp4';
    const clipFilename = `clip-${clipId}${ext}`;
    const outputPath = path.join(uploadsDir, clipFilename);
    const inputPath = path.isAbsolute(recording.file_path)
      ? recording.file_path
      : path.join(process.cwd(), recording.file_path);

    // 3. Perform the trimming using FFmpeg (graceful fallback if ffmpeg not installed)
    const { isFfmpegAvailable } = await import('../utils/videoTrimmer.js');
    const ffmpegAvailable = await isFfmpegAvailable();
    if (ffmpegAvailable && fs.existsSync(inputPath)) {
      try {
        await trimVideo(inputPath, outputPath, start, duration);
      } catch (ffmpegErr) {
        console.warn('⚠️ FFmpeg trim failed, clip reference saved without file:', ffmpegErr.message);
      }
    } else if (!ffmpegAvailable) {
      console.warn('⚠️ FFmpeg not found on this system. Install from https://ffmpeg.org/download.html and add to PATH to enable video trimming.');
    } else {
      console.warn('⚠️ Source video file not on disk. Recording was stored as browser-side blob? Clip reference saved.');
    }

    // Get clip file size if created
    let fileSize = 0;
    if (fs.existsSync(outputPath)) {
      fileSize = fs.statSync(outputPath).size;
    }

    // 4. Generate unique share token
    const shareToken = crypto.randomBytes(16).toString('hex');
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    let expiresAt = null;
    if (expires_in_days && Number(expires_in_days) > 0) {
      expiresAt = new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000);
    }

    const clipTitle = title || `Extrait : ${recording.title} (${start}s - ${end}s)`;

    if (isConnected && pool) {
      await pool.query(
        `INSERT INTO meeting_clips 
        (id, recording_id, created_by, title, description, start_time, end_time, filename, file_path, file_size, duration, share_token, is_public, password_hash, expires_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clipId,
          recording_id,
          userId,
          clipTitle,
          description || null,
          start,
          end,
          clipFilename,
          outputPath,
          fileSize,
          duration,
          shareToken,
          is_public === false ? 0 : 1,
          passwordHash,
          expiresAt
        ]
      );
    } else {
      memoryStore.meeting_clips.push({
        id: clipId,
        recording_id,
        created_by: userId,
        title: clipTitle,
        description: description || null,
        start_time: start,
        end_time: end,
        filename: clipFilename,
        file_path: outputPath,
        file_size: fileSize,
        duration,
        share_token: shareToken,
        is_public: is_public === false ? false : true,
        password_hash: passwordHash,
        expires_at: expiresAt,
        views_count: 0,
        created_at: new Date()
      });
    }

    return res.status(201).json({
      message: 'Clip generated successfully',
      clip: {
        id: clipId,
        title: clipTitle,
        start_time: start,
        end_time: end,
        duration,
        share_token: shareToken,
        share_url: `/share/${shareToken}`,
        video_url: `/uploads/${clipFilename}`
      }
    });
  } catch (error) {
    console.error('Create clip error:', error);
    return res.status(500).json({ error: 'Failed to generate video clip' });
  }
};

export const getClipByShareToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.query;
    const { pool, isConnected } = getDB();
    let clip = null;

    if (isConnected && pool) {
      const [rows] = await pool.query(
        `SELECT c.*, u.name as creator_name, r.title as original_title 
         FROM meeting_clips c 
         JOIN users u ON c.created_by = u.id 
         JOIN recordings r ON c.recording_id = r.id 
         WHERE c.share_token = ?`,
        [token]
      );
      if (rows.length > 0) clip = rows[0];
    } else {
      const c = memoryStore.meeting_clips.find(item => item.share_token === token);
      if (c) {
        const creator = memoryStore.users.find(u => u.id === c.created_by) || { name: 'Organisateur' };
        const rec = memoryStore.recordings.find(r => r.id === c.recording_id) || { title: 'Réunion JT-Meet' };
        clip = { ...c, creator_name: creator.name, original_title: rec.title };
      }
    }

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found or invalid link' });
    }

    // Check expiration
    if (clip.expires_at && new Date(clip.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired' });
    }

    // Check password protection
    if (clip.password_hash) {
      if (!password) {
        return res.status(401).json({
          is_protected: true,
          title: clip.title,
          creator_name: clip.creator_name,
          error: 'This clip is password protected'
        });
      }
      const isMatch = await bcrypt.compare(password, clip.password_hash);
      if (!isMatch) {
        return res.status(401).json({ is_protected: true, error: 'Incorrect password' });
      }
    }

    // Increment views counter
    if (isConnected && pool) {
      await pool.query('UPDATE meeting_clips SET views_count = views_count + 1 WHERE id = ?', [clip.id]);
    } else {
      clip.views_count = (clip.views_count || 0) + 1;
    }

    // Strip password hash from response
    const { password_hash, ...safeClip } = clip;

    return res.json({
      clip: {
        ...safeClip,
        video_url: `/uploads/${clip.filename}`
      }
    });
  } catch (error) {
    console.error('Get shared clip error:', error);
    return res.status(500).json({ error: 'Failed to access shared clip' });
  }
};

export const getUserClips = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pool, isConnected } = getDB();
    let clips = [];

    if (isConnected && pool) {
      const [rows] = await pool.query(
        `SELECT c.*, r.title as original_title 
         FROM meeting_clips c 
         JOIN recordings r ON c.recording_id = r.id 
         WHERE c.created_by = ? 
         ORDER BY c.created_at DESC`,
        [userId]
      );
      clips = rows;
    } else {
      clips = memoryStore.meeting_clips
        .filter(c => c.created_by === userId)
        .map(c => {
          const rec = memoryStore.recordings.find(r => r.id === c.recording_id);
          return {
            ...c,
            original_title: rec ? rec.title : 'Réunion JT-Meet'
          };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return res.json({ clips });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve clips' });
  }
};
