const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String },
  media: { type: String }, // Media file URL (photo, video, etc.)
  type: { type: String, enum: ['text', 'image', 'video', 'file', 'audio', 'poll'], default: 'text' },
  poll: {
    question: String,
    options: [String],
    votes: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, option: String }],
  }, // For polls
  timestamp: { type: Date, default: Date.now },
});

const chatSessionSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs
  maxParticipants: { type: Number, default: 2 }, // Default to 1-on-1 chats, customizable for groups
  isGroup: { type: Boolean, default: false }, // Flag to indicate if it's a group chat
  groupName: { type: String, default: null }, // Group name, if it's a group chat
  isRandom: { type: Boolean, default: false }, // Flag to indicate if it's a random match chat
  interests: [{ type: String }], // Store matched interests for random chats or group topics
  messages: [chatMessageSchema], // Array of messages (supports media, text, etc.)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Automatically update 'updatedAt' field when new messages are added or updated
chatSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
module.exports = ChatSession;
