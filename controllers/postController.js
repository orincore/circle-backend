const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Post = require('../models/Post');
const User = require('../models/User'); // Assuming you have a user model

/// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { uniqueId } = req.body;
      const user = await User.findOne({ uniqueId });

      if (!user) {
        return cb(new Error('User not found'));
      }

      const userFolder = path.join(__dirname, '../posts', user.uniqueId);

      // Create folder if it doesn't exist
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      cb(null, userFolder); // Save the media in the user's folder
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
}).single('media'); // Single file upload for the "media" field

// Create Post Controller
exports.createPost = async (req, res) => {
  // Use Multer to handle file upload if present
  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ message: 'File upload error', error: err.message });
    }

    const { uniqueId, postType, text, aspectRatio } = req.body; // Extract form-data fields

    // If postType is 'text' and there's no file
    if (postType === 'text' && !req.file) {
      try {
        const user = await User.findOne({ uniqueId });
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Create and save the text post
        const newPost = new Post({
          user: user._id,
          uniqueId: user.uniqueId,
          postType,
          text, // Save the text content
        });

        await newPost.save();
        res.status(201).json({ message: 'Text post created successfully', post: newPost });
      } catch (error) {
        console.error('Error creating text post:', error);
        res.status(500).json({ message: 'Server error' });
      }
    } else if (req.file) {
      // Handle media file (image, video, etc.)
      try {
        const user = await User.findOne({ uniqueId });
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        let mediaPath = path.join('/posts', user.uniqueId, req.file.filename); // Path to the uploaded file

        // Create and save the new media post
        const newPost = new Post({
          user: user._id,
          uniqueId: user.uniqueId,
          postType,
          media: mediaPath,
          aspectRatio: postType === 'image' || postType === 'video' ? aspectRatio : null,
        });

        await newPost.save();
        res.status(201).json({ message: 'Media post created successfully', post: newPost });
      } catch (error) {
        console.error('Error creating media post:', error);
        res.status(500).json({ message: 'Server error' });
      }
    }
  });
};


// Edit a post
exports.editPost = async (req, res) => {
  const { postId, text } = req.body;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.postType === 'text' && text) {
      post.text = text; // Update text content if it's a text post
    }

    await post.save();

    res.status(200).json({ message: 'Post updated successfully', post });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // If the post contains media, delete the media file
    if (post.media) {
      const filePath = path.join(__dirname, '..', post.media);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch feed posts based on user's interests
exports.getFeedPosts = async (req, res) => {
  const { uniqueId, page = 1, limit = 10 } = req.query; // Pagination parameters from the query

  try {
    // Find the user by their uniqueId
    const user = await User.findOne({ uniqueId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the user's interests
    const userInterests = user.interests;

    // Query posts that match at least one of the user's interests
    const posts = await Post.find({
      interests: { $in: userInterests }, // Match at least one interest
    })
      .sort({ createdAt: -1 }) // Sort posts by newest first
      .skip((page - 1) * limit) // Pagination: skip posts for previous pages
      .limit(parseInt(limit)) // Limit the number of posts returned
      .lean(); // Convert Mongoose documents to plain JavaScript objects

    // Return posts and pagination data
    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      total: posts.length,
      posts,
    });
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};