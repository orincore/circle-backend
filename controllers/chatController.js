const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// PostgreSQL Pool Configuration
const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,
  ssl: { rejectUnauthorized: false },
});

// Multer Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'circle_chat_media',
    resource_type: 'auto', // Automatically determine resource type (image, video, audio)
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mp3', 'wav'],
  },
});

// Multer Middleware for File Upload
const upload = multer({ storage }).single('media');

// **Send a Message**
exports.sendMessage = async (req, res) => {
  const { sessionId, senderId, message, type } = req.body;

  try {
    // Check if the session exists
    const chatQuery = `SELECT * FROM chat_sessions WHERE id = $1`;
    const chatSession = await pool.query(chatQuery, [sessionId]);

    if (chatSession.rowCount === 0) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Handle media upload
    upload(req, res, async (err) => {
      if (err) {
        console.error('Media upload error:', err);
        return res.status(500).json({ error: 'Media upload failed' });
      }

      const mediaUrl = req.file?.path || null;

      const insertMessageQuery = `
        INSERT INTO messages (chat_session_id, sender_id, message, type, media_url, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *;
      `;
      const values = [sessionId, senderId, message || null, mediaUrl ? type || 'media' : 'text', mediaUrl];
      const result = await pool.query(insertMessageQuery, values);

      res.status(201).json({ message: 'Message sent', data: result.rows[0] });
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// **Create a Personal Chat**
exports.createPersonalChat = async (req, res) => {
  const { userId, recipientId } = req.body;

  if (!userId || !recipientId) {
    return res.status(400).json({ message: 'Both userId and recipientId are required.' });
  }

  try {
    // Check if a chat session already exists between these users
    const checkQuery = `
      SELECT * FROM chat_sessions 
      WHERE is_group = FALSE AND participants @> ARRAY[$1, $2]::uuid[];
    `;
    const existingChat = await pool.query(checkQuery, [userId, recipientId]);

    if (existingChat.rowCount > 0) {
      return res.json({ message: 'Existing chat session', chatSession: existingChat.rows[0] });
    }

    // Create a new chat session
    const createQuery = `
      INSERT INTO chat_sessions (participants, is_group, created_at)
      VALUES (ARRAY[$1, $2]::uuid[], FALSE, NOW())
      RETURNING *;
    `;
    const newChatSession = await pool.query(createQuery, [userId, recipientId]);

    res.status(201).json({ message: 'Chat session created', chatSession: newChatSession.rows[0] });
  } catch (error) {
    console.error('Error creating personal chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// **Create a Group Chat**
exports.createGroupChat = async (req, res) => {
  const { creatorId, participantIds, interests, groupName } = req.body;

  if (!creatorId || !participantIds || participantIds.length > 249) {
    return res.status(400).json({ message: 'Group chat must have between 1 and 249 participants.' });
  }

  try {
    const createQuery = `
      INSERT INTO chat_sessions (participants, is_group, group_name, interests, max_participants, created_at)
      VALUES (ARRAY[$1 || $2]::uuid[], TRUE, $3, $4, 250, NOW())
      RETURNING *;
    `;
    const participants = [creatorId, ...participantIds];
    const groupChat = await pool.query(createQuery, [
      creatorId,
      participantIds,
      groupName || 'Unnamed Group',
      interests || null,
    ]);

    res.status(201).json({ message: 'Group chat created', chatSession: groupChat.rows[0] });
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// **Fetch Chat History**
exports.getChatHistory = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const historyQuery = `
      SELECT m.*, u.username, u.profile_picture
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_session_id = $1
      ORDER BY m.created_at ASC;
    `;
    const messages = await pool.query(historyQuery, [sessionId]);

    if (messages.rowCount === 0) {
      return res.status(404).json({ message: 'No chat history found.' });
    }

    res.status(200).json({ messages: messages.rows });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// **Random 1-on-1 Chat Matching**
exports.randomMatchChat = async (req, res) => {
  const { userId, interests } = req.body;

  try {
    const matchQuery = `
      SELECT id, username, profile_picture, interests
      FROM users
      WHERE id != $1 AND interests && $2::text[]
      ORDER BY random()
      LIMIT 1;
    `;
    const matchedUser = await pool.query(matchQuery, [userId, interests]);

    if (matchedUser.rowCount === 0) {
      return res.status(404).json({ message: 'No match found. Try again later.' });
    }

    const createQuery = `
      INSERT INTO chat_sessions (participants, is_group, interests, is_random, created_at)
      VALUES (ARRAY[$1, $2]::uuid[], FALSE, $3, TRUE, NOW())
      RETURNING *;
    `;
    const randomChat = await pool.query(createQuery, [userId, matchedUser.rows[0].id, interests]);

    res.status(201).json({ message: 'Random chat session created', chatSession: randomChat.rows[0] });
  } catch (error) {
    console.error('Error creating random chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// **Random Group Chat Matching**
exports.randomGroupChat = async (req, res) => {
  const { userId, interests } = req.body;

  try {
    const matchQuery = `
      SELECT id, username, profile_picture, interests
      FROM users
      WHERE id != $1 AND interests && $2::text[]
      ORDER BY random()
      LIMIT 9;
    `;
    const matchedUsers = await pool.query(matchQuery, [userId, interests]);

    if (matchedUsers.rowCount === 0) {
      return res.status(404).json({ message: 'No suitable group found. Try again later.' });
    }

    const participantIds = matchedUsers.rows.map((user) => user.id);
    const createQuery = `
      INSERT INTO chat_sessions (participants, is_group, interests, max_participants, is_random, created_at)
      VALUES (ARRAY[$1 || $2]::uuid[], TRUE, $3, 10, TRUE, NOW())
      RETURNING *;
    `;
    const groupChat = await pool.query(createQuery, [userId, participantIds, interests]);

    res.status(201).json({ message: 'Random group chat created', chatSession: groupChat.rows[0] });
  } catch (error) {
    console.error('Error creating random group chat:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
