const express = require('express');
const { addUserInterests, getInterests } = require('../controllers/interestController');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

// Add interests to user's profile
router.post('/add', authenticate, addUserInterests);

// Get all available interests
router.get('/all', authenticate, getInterests);

module.exports = router;
