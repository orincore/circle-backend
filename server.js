const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken'); // For JWT-based authentication
const multer = require('multer'); // For handling file uploads
const path = require('path'); // For handling file paths
const cloudinary = require('cloudinary').v2;
const { Pool } = require('pg'); // PostgreSQL pool for Neon
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes'); // Profile routes
const securityHeaders = require('./middleware/securityHeaders'); // Import security headers middleware
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

// Apply security headers
app.use(securityHeaders);

// Middleware for parsing JSON and enabling CORS
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Replace with your frontend URL
    credentials: true, // Allow credentials like tokens to be sent
  })
);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure PostgreSQL with Neon
const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Static file serving (e.g., fallback for existing uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup multer for handling file uploads (uses Cloudinary)
const storage = multer.memoryStorage(); // Memory storage for immediate Cloudinary upload
const upload = multer({ storage });

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/profile', profileRoutes); // Use the profile routes
app.use('/api/chat', chatRoutes);

// Handle 404 errors (route not found)
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.io with CORS support
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*', // Allow CORS based on environment
  },
});

// Global object to track active user sessions
const activeUsers = {};

// Socket.io middleware for token-based authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token; // Token passed via socket handshake

  // Verify the token
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('JWT verification failed:', err.message);
        return next(new Error('Authentication error'));
      }

      // Attach the decoded user data to the socket object
      socket.user = decoded;
      next();
    });
  } else {
    next(new Error('Authentication error'));
  }
});

// Socket.io events with unique user sessions and active session tracking
io.on('connection', (socket) => {
  const userId = socket.user.id; // User ID from the decoded token

  // If the user already has an active session, disconnect the old one
  if (activeUsers[userId]) {
    activeUsers[userId].disconnect();
  }

  // Store the current session
  activeUsers[userId] = socket;

  // Join a room unique to this user
  socket.join(`user-${userId}`);
  console.log(`User with ID ${userId} connected and joined room user-${userId}`);

  // Listen for messages and broadcast them to the user's unique room
  socket.on('message', (data) => {
    io.to(`user-${userId}`).emit('message', data); // Emit message to the user's room
  });

  // Handle other custom events for the user
  socket.on('customEvent', (data) => {
    io.to(`user-${userId}`).emit('customEvent', data); // Emit custom event to the user's room
  });

  // Optionally allow the user to join additional rooms
  socket.on('joinRoom', (room) => {
    if (isValidRoom(room)) {
      socket.join(room);
      console.log(`User with ID ${userId} joined room: ${room}`);
    } else {
      socket.emit('error', { message: 'Invalid room' });
    }
  });

  // Handle user reconnection
  socket.on('reconnect', () => {
    socket.join(`user-${userId}`);
    console.log(`User with ID ${userId} reconnected`);
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log(`User with ID ${userId} disconnected`);
    delete activeUsers[userId]; // Remove the user from active sessions
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Function to validate rooms (optional)
function isValidRoom(room) {
  // Check if the room exists or the user is authorized to join
  return true;
}
