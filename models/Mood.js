const mongoose = require('mongoose');

const MoodSchema = new mongoose.Schema({
    mood_level: {
      type: Number, // e.g., 1-5 for mood levels
      required: true,
    },
    description: {
      type: String, // Optional description of mood
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  });
  
  MoodSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
  });
  
  module.exports = {
    User: mongoose.model('User', UserSchema),
    Post: mongoose.model('Post', PostSchema),
    Mood: mongoose.model('Mood', MoodSchema)
  };
  