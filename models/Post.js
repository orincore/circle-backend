const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uniqueId: { type: String, required: true },
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'voice'], // Define allowed post types
    required: true,
  },
  text: { type: String }, // For text posts
  media: { type: String }, // Path to the media file (image, video, etc.)
  aspectRatio: { type: String }, // Aspect ratio for media posts
  interests: [{ type: String }], // Interests related to the post
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
