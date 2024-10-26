const ChatSession = require('../models/ChatSession');
const User = require('../models/User'); // Assuming you have a user model
const multer = require('multer');
const path = require('path');


// Setup multer for handling file uploads (limit to 100MB)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../uploads/chats')); // Store media files in 'uploads/chats'
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + file.originalname;
      cb(null, uniqueSuffix);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
  }).single('media'); // Upload a single file at a time
  
  // Send a message (text or media) in a personal or group chat
  exports.sendMessage = async (req, res) => {
    const { sessionId, sender, message, type } = req.body;
  
    try {
      const chatSession = await ChatSession.findById(sessionId);
      if (!chatSession) {
        return res.status(404).json({ message: 'Chat session not found' });
      }
  
      // Handle media uploads and text messages
      upload(req, res, async (err) => {
        if (err) {
          return res.status(500).json({ message: 'File upload error', error: err });
        }
  
        // Create the message object
        const newMessage = {
          sender,
          message: message || '', // If no text is provided, use an empty string
          type: req.file ? type || 'file' : 'text', // Default to 'file' type if media exists
          media: req.file ? `/uploads/chats/${req.file.filename}` : null, // Store media URL if a file was uploaded
        };
  
        chatSession.messages.push(newMessage); // Add the new message to the chat session
        await chatSession.save();
  
        res.json({ message: 'Message sent', chatSession });
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };

// Create a personal chat session between two users
exports.createPersonalChat = async (req, res) => {
    const { userId, recipientId } = req.body;
  
    if (!userId || !recipientId) {
      return res.status(400).json({ message: 'Both userId and recipientId are required.' });
    }
  
    try {
      // Check if a chat session already exists between these two users
      let existingChat = await ChatSession.findOne({
        participants: { $all: [userId, recipientId] },
        maxParticipants: 2, // Only for 1-on-1 chats
      });
  
      if (!existingChat) {
        // If no existing session, create a new one
        const newChatSession = new ChatSession({
          participants: [userId, recipientId],
          maxParticipants: 2, // 1-on-1 chat
        });
  
        await newChatSession.save();
        return res.json({ message: 'Personal chat session created', chatSession: newChatSession });
      }
  
      // If a session already exists, return it
      res.json({ message: 'Existing personal chat session', chatSession: existingChat });
    } catch (error) {
      console.error('Error creating personal chat session:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  
  
// Create a manual group chat with a 250 user limit and optional group name
exports.createGroupChat = async (req, res) => {
    const { creatorId, participantIds, interests, groupName } = req.body;
  
    if (!creatorId || !participantIds || participantIds.length > 249) {
      return res.status(400).json({ message: 'Group chat must have between 1 and 249 participants.' });
    }
  
    try {
      const newGroupChat = new ChatSession({
        participants: [creatorId, ...participantIds],
        maxParticipants: 250,
        isGroup: true,
        groupName: groupName || 'Unnamed Group', // Use 'Unnamed Group' if no group name is provided
        interests: interests || [],
      });
  
      await newGroupChat.save();
  
      res.json({ message: 'Group chat created successfully', newGroupChat });
    } catch (error) {
      console.error('Error creating group chat:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  
// Match users for a random 1-on-1 chat based on interests
exports.randomMatchChat = async (req, res) => {
  const { userId, interests } = req.body;

  try {
    const matchedUser = await findRandomMatch(userId, interests);

    if (!matchedUser) {
      return res.status(404).json({ message: 'No match found. Try again later.' });
    }

    const newChatSession = new ChatSession({
      participants: [userId, matchedUser._id],
      isRandom: true,
      interests: findMatchingInterests(interests, matchedUser.interests),
    });

    await newChatSession.save();

    res.json({ message: 'Random chat session created', newChatSession });
  } catch (error) {
    console.error('Error creating random chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Match users for a random group chat (10 users max) based on interests
exports.randomGroupChat = async (req, res) => {
  const { userId, interests } = req.body;

  try {
    const matchedUsers = await findRandomGroupMatch(userId, interests);

    if (matchedUsers.length < 1) {
      return res.status(404).json({ message: 'No suitable group found. Try again later.' });
    }

    const newGroupChat = new ChatSession({
      participants: [userId, ...matchedUsers],
      maxParticipants: 10,
      isGroup: true,
      isRandom: true,
      interests: findMatchingInterests(interests, matchedUsers[0].interests),
    });

    await newGroupChat.save();

    res.json({ message: 'Random group chat created', newGroupChat });
  } catch (error) {
    console.error('Error creating random group chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Fetch chat history for a specific chat session (group or personal)
exports.getChatHistory = async (req, res) => {
    const { sessionId } = req.params;
  
    try {
      // Find the chat session, populate participant details (username, profilePicture, etc.)
      const chatSession = await ChatSession.findById(sessionId)
        .populate('participants', 'username profilePicture') // Add other relevant user fields
        .exec();
  
      if (!chatSession) {
        return res.status(404).json({ message: 'Chat session not found' });
      }
  
      // Return chat history and participants information
      res.json({
        sessionId: chatSession._id,
        participants: chatSession.participants,
        isGroup: chatSession.isGroup, // Indicate whether it's a group chat
        groupName: chatSession.isGroup ? chatSession.groupName : null, // Optional group name if it's a group chat
        messages: chatSession.messages, // Return all messages in the chat session
        createdAt: chatSession.createdAt,
      });
    } catch (error) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
  
// Helper function to find a random match for 1-on-1 chat
const findRandomMatch = async (userId, userInterests) => {
  const users = await User.find({
    _id: { $ne: userId }, // Exclude the current user
    interests: { $in: userInterests },
  });

  // Shuffle the users array and return a random match
  return users.length > 0 ? users[Math.floor(Math.random() * users.length)] : null;
};

// Helper function to find a random group match (max 10 users) with common interests
const findRandomGroupMatch = async (userId, userInterests) => {
  const group = await User.aggregate([
    { $match: { _id: { $ne: userId }, interests: { $in: userInterests } } },
    { $sample: { size: 9 } }, // Get a random sample of 9 users (1 + 9 = 10)
  ]);

  return group;
};

// Helper function to find matching interests
const findMatchingInterests = (userInterests, matchedInterests) => {
  return userInterests.filter(interest => matchedInterests.includes(interest));
};
