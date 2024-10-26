const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = require('../middleware/upload'); // This is the multer setup from above

// Get user profile
router.get('/:uniqueId', userController.getUserProfile);

// Update user profile (with profile picture upload)
router.put('/:uniqueId', upload.single('profilePicture'), userController.updateUserProfile);

// Remove profile picture
router.delete('/:uniqueId/profile-picture', userController.removeProfilePicture);

module.exports = router;
