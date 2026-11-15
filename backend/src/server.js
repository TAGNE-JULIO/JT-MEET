import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { initDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import recordingRoutes from './routes/recordingRoutes.js';
import clipRoutes from './routes/clipRoutes.js';
import setupMeetingSocket from './sockets/meetingSocket.js';

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception intercepted:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection intercepted:', reason);
});

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow frontend development or production domains
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static directory for uploaded recordings and clips
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Static directory for web client app
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/clips', clipRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'JT-Meet API',
    timestamp: new Date().toISOString()
  });
});

// SPA Catch-all: serve index.html for direct Google Meet-style URLs (e.g. /abc-defg-hij or /meet/abc-defg-hij)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return res.status(404).json({ error: 'Endpoint non trouvé' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Setup WebRTC and collaboration sockets
setupMeetingSocket(io);

// Start Server & Connect Database
const startServer = async () => {
  await initDB();

  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 JT-Meet Backend running on port ${PORT}`);
    console.log(`📡 WebSocket ready for WebRTC & Chat`);
    console.log(`📁 Uploads served from ${uploadDir}`);
    console.log(`=========================================`);
  });
};

startServer();
