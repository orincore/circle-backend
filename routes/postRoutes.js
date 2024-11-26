const express = require("express");
const postController = require("../controllers/postController");
const { authenticate } = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");


const router = express.Router();

// Create a Post
router.post("/create", authenticate, postController.uploadMiddleware, postController.createPost);

// Get Posts by Type
router.get("/type", authenticate, postController.getPostsByType);

// Like or Unlike a Post
router.post("/like/:postId", authenticate, postController.toggleLike);

// Add a Comment to a Post
router.post("/comment/:postId", authenticate, postController.addComment);

// Share a Post
router.post("/share/:postId", authenticate, postController.sharePost);

// Delete a Post
router.delete("/delete/:postId", authenticate, postController.deletePost);

// Get Comments for a Post
router.get('/comments/:postId', authenticate, postController.getCommentsForPost);

// Delete a Comment
router.delete('/comments/:commentId', authenticate, postController.deleteComment);

// Save Posts
router.post("/save/:postId", authenticate, postController.savePost);
router.get("/saved", authenticate, postController.getSavedPosts);

// Report Posts
router.post("/report/:postId", authenticate, postController.reportPost);
router.get("/reports", authenticate, isAdmin, postController.getReports);

module.exports = router;
