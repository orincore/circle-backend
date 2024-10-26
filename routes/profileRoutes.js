const express = require('express');
const { getUserProfile, updateUserProfile } = require('../controllers/profileController');
const { authenticate } = require('../middleware/authMiddleware'); // Import the authenticate middleware
const router = express.Router();

// Route to get the current user's profile
router.get('/me', authenticate, getUserProfile);

// Route to update the current user's profile
router.put('/me', authenticate, updateUserProfile);

module.exports = router;
