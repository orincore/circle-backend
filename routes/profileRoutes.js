const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");
const multer = require("multer");

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

const router = express.Router();

// **Profile Routes**
router.get("/me", authenticate, profileController.getUserProfile); // Fetch current user's profile
router.put("/me", authenticate, profileController.updateUserProfile); // Update profile details
router.post("/me/toggle-follow", authenticate, profileController.toggleFollow); // Follow or unfollow a user

// **Activity Feed**
router.get("/feed/activity", authenticate, profileController.getActivityFeed); // Get posts from followed users

router.get("/:uniqueId/posts", authenticate, profileController.getUserPosts);

// **Other Users' Routes**
router.get("/:uniqueId", authenticate, profileController.getUserProfileById); // Fetch another user's profile by uniqueId

module.exports = router;
