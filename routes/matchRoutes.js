const express = require('express');
const { findMatchingUsers } = require('../controllers/matchController');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

// Route to find matching users
router.get('/find', authenticate, findMatchingUsers);

module.exports = router;
