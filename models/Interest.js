// models/UserInterest.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define UserInterest Schema
const userInterestSchema = new Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Interest', required: true },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields automatically
});

// Export the model
const UserInterest = mongoose.model('UserInterest', userInterestSchema);

module.exports = UserInterest;
