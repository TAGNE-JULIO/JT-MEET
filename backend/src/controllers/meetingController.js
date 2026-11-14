import { v4 as uuidv4 } from 'uuid';
import { getDB, memoryStore } from '../config/db.js';

// Generate human-friendly meeting code like "jt-abc-def"
const generateMeetingCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `jt-${segment(3)}-${segment(3)}`;
};

export const createMeeting = async (req, res) => {
  try {
    const { title, description, scheduled_start, max_participants, is_locked, settings } = req.body;
    const hostId = req.user.id;
    const meetingId = uuidv4();
    const code = generateMeetingCode();
    const meetingTitle = title && title.trim() ? title.trim() : 'Nouvelle Réunion JT-Meet';
    const status = scheduled_start ? 'scheduled' : 'active';
    const startedAt = status === 'active' ? new Date() : null;

    const { pool, isConnected } = getDB();

    if (isConnected && pool) {
      await pool.query(
        `INSERT INTO meetings 
        (id, code, title, description, host_id, status, scheduled_start, started_at, max_participants, is_locked, settings) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          meetingId,
          code,
          meetingTitle,
          description || null,
          hostId,
          status,
          scheduled_start ? new Date(scheduled_start) : null,
          startedAt,
          max_participants || 50,
          is_locked ? 1 : 0,
          settings ? JSON.stringify(settings) : JSON.stringify({ allowChat: true, allowScreenShare: true })
        ]
      );
    } else {
      memoryStore.meetings.push({
        id: meetingId,
        code,
        title: meetingTitle,
        description: description || null,
        host_id: hostId,
        status,
        scheduled_start: scheduled_start ? new Date(scheduled_start) : null,
        started_at: startedAt,
        max_participants: max_participants || 50,
        is_locked: is_locked || false,
        settings: settings || { allowChat: true, allowScreenShare: true },
        created_at: new Date()
      });
    }

    return res.status(201).json({
      message: 'Meeting created successfully',
      meeting: {
        id: meetingId,
        code,
        title: meetingTitle,
        status,
        host_id: hostId,
        scheduled_start,
        started_at: startedAt,
        join_url: `/meet/${code}`
      }
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    return res.status(500).json({ error: 'Failed to create meeting' });
  }
};

export const getMeetingByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { pool, isConnected } = getDB();
    let meeting = null;

    if (isConnected && pool) {
      const [rows] = await pool.query(
        `SELECT m.*, u.name as host_name, u.email as host_email 
         FROM meetings m 
         JOIN users u ON m.host_id = u.id 
         WHERE m.code = ?`,
        [code]
      );
      if (rows.length > 0) meeting = rows[0];
    } else {
      const m = memoryStore.meetings.find(item => item.code === code || item.id === code);
      if (m) {
        const host = memoryStore.users.find(u => u.id === m.host_id) || { name: 'Host', email: 'host@jtmeet.com' };
        meeting = { ...m, host_name: host.name, host_email: host.email };
      }
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    return res.json({ meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    return res.status(500).json({ error: 'Failed to retrieve meeting' });
  }
};

export const getUserMeetings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pool, isConnected } = getDB();
    let meetings = [];

    if (isConnected && pool) {
      const [rows] = await pool.query(
        `SELECT * FROM meetings WHERE host_id = ? ORDER BY created_at DESC`,
        [userId]
      );
      meetings = rows;
    } else {
      meetings = memoryStore.meetings
        .filter(m => m.host_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return res.json({ meetings });
  } catch (error) {
    console.error('Get user meetings error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user meetings' });
  }
};

export const endMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { pool, isConnected } = getDB();

    if (isConnected && pool) {
      const [rows] = await pool.query('SELECT * FROM meetings WHERE id = ? AND host_id = ?', [id, userId]);
      if (rows.length === 0) {
        return res.status(403).json({ error: 'Unauthorized or meeting not found' });
      }
      await pool.query('UPDATE meetings SET status = "ended", ended_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    } else {
      const m = memoryStore.meetings.find(item => item.id === id && item.host_id === userId);
      if (!m) return res.status(403).json({ error: 'Unauthorized or meeting not found' });
      m.status = 'ended';
      m.ended_at = new Date();
    }

    return res.json({ message: 'Meeting ended successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to end meeting' });
  }
};
