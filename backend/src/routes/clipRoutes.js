import express from 'express';
import { createClip, getClipByShareToken, getUserClips } from '../controllers/clipController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, createClip);
router.get('/my-clips', authenticateToken, getUserClips);
router.get('/share/:token', getClipByShareToken);

export default router;
