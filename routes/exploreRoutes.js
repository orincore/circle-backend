const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // Assuming you have a Post model

// GET /api/explore - Fetch public posts for the Explore page
router.get('/', async (req, res) => {
  try {
    // Fetch the latest 20 public posts sorted by creation time in descending order
    const posts = await Post.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ posts });
  } catch (err) {
    console.error('Error fetching explore posts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
