import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { uploadRecording, getUserRecordings, getRecordingById } from '../controllers/recordingController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `rec-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

router.post('/upload', authenticateToken, upload.single('video'), uploadRecording);
router.get('/my-recordings', authenticateToken, getUserRecordings);
router.get('/:id', authenticateToken, getRecordingById);

export default router;
