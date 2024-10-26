// models/Goal.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define Goal Schema
const goalSchema = new Schema({
  goal_text: { type: String, required: true },
  is_completed: { type: Boolean, default: false },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields automatically
});

// Export the model
const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;
