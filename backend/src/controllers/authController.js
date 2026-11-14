import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDB, memoryStore } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jt_meet_super_secret_jwt_key_2026_modern_collab';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const { pool, isConnected } = getDB();
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    if (isConnected && pool) {
      // Check if email exists
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      await pool.query(
        'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
        [userId, name, email, hashedPassword]
      );
    } else {
      // Memory store fallback
      const exists = memoryStore.users.find(u => u.email === email);
      if (exists) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      memoryStore.users.push({
        id: userId,
        name,
        email,
        password_hash: hashedPassword,
        created_at: new Date()
      });
    }

    const token = jwt.sign({ id: userId, name, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: userId, name, email },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { pool, isConnected } = getDB();
    let user = null;

    if (isConnected && pool) {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (rows.length > 0) user = rows[0];
    } else {
      user = memoryStore.users.find(u => u.email === email);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pool, isConnected } = getDB();
    let user = null;

    if (isConnected && pool) {
      const [rows] = await pool.query('SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = ?', [userId]);
      if (rows.length > 0) user = rows[0];
    } else {
      const found = memoryStore.users.find(u => u.id === userId);
      if (found) {
        user = { id: found.id, name: found.name, email: found.email, avatar_url: found.avatar_url, created_at: found.created_at };
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
