const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Allowed file types for profile pictures
const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Controller to fetch user profile by uniqueId
exports.getUserProfile = async (req, res) => {
  try {
    const uniqueId = req.user.uniqueId; // Assuming uniqueId comes from authenticated user
    const user = await User.findOne({ uniqueId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      bio: user.bio,
      profilePicture: user.profilePicture,
      interests: user.interests,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      posts: user.posts,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Controller to update user profile by uniqueId (with profile picture and username)
exports.updateUserProfile = async (req, res) => {
  try {
    const uniqueId = req.user.uniqueId; // Fetch uniqueId from authenticated user
    const updatedData = req.body;

    let user = await User.findOne({ uniqueId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If username is being updated, ensure it's unique
    if (updatedData.username && updatedData.username !== user.username) {
      const existingUserByUsername = await User.findOne({ username: updatedData.username });
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Username already taken.' });
      }
    }

    // Handle profile picture upload if a new file is being uploaded
    if (req.file) {
      const fileSize = req.file.size;
      const fileType = req.file.mimetype;

      // Validate file type and size
      if (!allowedImageTypes.includes(fileType)) {
        return res.status(400).json({ message: 'Invalid file type. Only JPEG and PNG are allowed.' });
      }

      if (fileSize > MAX_FILE_SIZE) {
        return res.status(400).json({ message: 'File size too large. Max limit is 5MB.' });
      }

      const oldProfilePic = user.profilePicture;
      const newProfilePicPath = path.join(__dirname, '../uploads', `${uniqueId}-${req.file.originalname}`);

      // Move the uploaded file to the correct folder
      fs.rename(req.file.path, newProfilePicPath, (err) => {
        if (err) {
          console.error('Error renaming file:', err);
          return res.status(500).json({ message: 'Error uploading profile picture' });
        }

        // Update profile picture path
        updatedData.profilePicture = `uploads/${uniqueId}-${req.file.originalname}`;

        // Remove old profile picture if it's not the default picture
        if (oldProfilePic !== 'defaults/default-pic.png' && fs.existsSync(path.join(__dirname, '../', oldProfilePic))) {
          fs.unlink(path.join(__dirname, '../', oldProfilePic), (err) => {
            if (err) console.error('Error deleting old profile picture:', err);
          });
        }
      });
    }

    // Update the user data in the database
    user = await User.findOneAndUpdate({ uniqueId }, updatedData, { new: true });

    // Adding a cache-busting timestamp to the profile picture URL to avoid caching issues
    const updatedProfile = {
      ...user.toObject(),
      profilePicture: `${user.profilePicture}?t=${Date.now()}`, // Appending timestamp to bust cache
    };

    res.status(200).json(updatedProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Controller to remove profile picture
exports.removeProfilePicture = async (req, res) => {
  try {
    const uniqueId = req.user.uniqueId; // Ensure we're using the authenticated user's uniqueId

    const user = await User.findOne({ uniqueId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profilePicPath = user.profilePicture;

    // Reset profile picture to default
    user.profilePicture = 'defaults/default-pic.png';

    // Remove old profile picture from the uploads folder if it's not the default
    if (profilePicPath !== 'defaults/default-pic.png' && fs.existsSync(path.join(__dirname, '../', profilePicPath))) {
      fs.unlink(path.join(__dirname, '../', profilePicPath), (err) => {
        if (err) {
          console.error('Error deleting profile picture:', err);
        }
      });
    }

    await user.save();
    res.status(200).json({ message: 'Profile picture removed successfully' });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
