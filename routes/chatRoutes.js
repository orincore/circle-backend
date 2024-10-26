const express = require('express');
const chatController = require('../controllers/chatController');
const router = express.Router();

// Create a manual group chat (250 max)
router.post('/create-group', chatController.createGroupChat);

// Match users for random 1-on-1 chat based on interests
router.post('/random-chat', chatController.randomMatchChat);

// Match users for a random group chat (10 users max) based on interests
router.post('/random-group-chat', chatController.randomGroupChat);

// Create a personal chat (1-on-1 chat)
router.post('/create-personal-chat', chatController.createPersonalChat);

// Send a message (text or media) in a personal or group chat
router.post('/send-message', chatController.sendMessage);

// Fetch chat history for a given session
router.get('/chat-history/:sessionId', chatController.getChatHistory); 

module.exports = router;
