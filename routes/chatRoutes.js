const express = require('express');
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware'); // Authentication middleware
const multer = require('multer');

// Define a router
const router = express.Router();

// Middleware for handling media uploads
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
}).single('media');

// Routes for chat functionality

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

module.exports = router;
