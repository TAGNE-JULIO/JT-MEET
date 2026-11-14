import express from 'express';
import { createMeeting, getMeetingByCode, getUserMeetings, endMeeting } from '../controllers/meetingController.js';
import { authenticateToken, optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, createMeeting);
router.get('/my-meetings', authenticateToken, getUserMeetings);
router.get('/:code', optionalAuth, getMeetingByCode);
router.put('/:id/end', authenticateToken, endMeeting);

export default router;
