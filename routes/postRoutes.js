const express = require('express');
const postController = require('../controllers/postController');
const router = express.Router();

// Create a new post
router.post('/create', postController.createPost);

// Edit a post
router.put('/edit', postController.editPost);

// Delete a post
router.delete('/delete/:postId', postController.deletePost);

// Route to get feed posts based on user's interests
router.get('/feed', postController.getFeedPosts);

module.exports = router;
