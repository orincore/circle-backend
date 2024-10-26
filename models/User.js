const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Import the UUID library

// Define the User Schema
const UserSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    unique: true, // Ensure the username is unique
    required: true, // Make it required
    minlength: 3,
  },
  uniqueId: {
    type: String,
    unique: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  interests: {
    type: [String], // Array of interests for the user
  },
  bio: {
    type: String,
    default: '',  // Default empty string if no bio is provided
  },
  profilePicture: {
    type: String,
    default: 'defaults/default-pic.png', // Default picture if none is provided
  },
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to automatically generate a uniqueId before saving the user
UserSchema.pre('save', function (next) {
  if (!this.uniqueId) {
    this.uniqueId = uuidv4(); // Automatically generate uniqueId if not already set
  }
  this.updatedAt = Date.now(); // Update the updatedAt timestamp
  next();
});

module.exports = mongoose.model('User', UserSchema);
