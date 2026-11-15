import express from 'express';
import { createMeeting, getMeetingByCode, getUserMeetings, endMeeting } from '../controllers/meetingController.js';
import { authenticateToken, optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Allow guests or authenticated users to create instant/scheduled meetings like Google Meet
router.post('/', optionalAuth, createMeeting);
router.get('/my-meetings', authenticateToken, getUserMeetings);
router.get('/:code', optionalAuth, getMeetingByCode);
router.put('/:id/end', optionalAuth, endMeeting);

export default router;
