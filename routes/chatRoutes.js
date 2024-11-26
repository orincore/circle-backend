const express = require('express');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware'); // Authentication middleware
const multer = require('multer');
const { joinLivePool } = require('../controllers/chatController');
const { matchUser } = require('../controllers/chatController');
const { matchGroup } = require('../controllers/chatController');

// Define a router
const router = express.Router();

// Middleware for handling media uploads
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
}).single('media');

// Routes for chat functionality

// POST /api/chat/live-pool
router.post('/live-pool', joinLivePool);

// POST /api/chat/match
router.post('/match', matchUser);

// POST /api/chat/group-match
router.post('/group-match', matchGroup);

// Create a manual group chat (up to 250 participants)
router.post('/create-group', authenticate, chatController.createGroupChat);

// Match users for random 1-on-1 chat based on interests
router.post('/random-chat', authenticate, chatController.randomMatchChat);

// Match users for a random group chat (up to 10 users) based on interests
router.post('/random-group-chat', authenticate, chatController.randomGroupChat);

// Create a personal chat session (1-on-1)
router.post('/create-personal-chat', authenticate, chatController.createPersonalChat);

// Send a message (text or media) in a personal or group chat
router.post('/send-message', authenticate, upload, chatController.sendMessage);

// Fetch chat history for a specific chat session
router.get('/chat-history/:sessionId', authenticate, chatController.getChatHistory);

// GET /api/chat/active-users
router.get('/active-users', async (req, res) => {
  try {
    const query = `
      SELECT user_id, interests, last_active 
      FROM live_users 
      WHERE is_available = TRUE;
    `;
    const activeUsers = await pool.query(query);
    res.status(200).json({ activeUsers: activeUsers.rows });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/chat/leave-pool/:userId
router.delete('/leave-pool/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const query = `
      UPDATE live_users 
      SET is_available = FALSE 
      WHERE user_id = $1;
    `;
    await pool.query(query, [userId]);
    res.status(200).json({ message: 'User removed from live pool' });
  } catch (error) {
    console.error('Error removing user from live pool:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
