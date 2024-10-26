const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import the User model

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from the "Authorization" header

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by the decoded token and ensure the token exists in the user's tokens array
    const user = await User.findOne({ _id: decoded.id, 'tokens.token': token });
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. Token not found in user records.' });
    }

    // Attach user info to request
    req.user = {
      id: decoded.id,
      uniqueId: decoded.uniqueId,
    };
    req.token = token; // Attach the token to request for revocation later

    next(); // Proceed to the next middleware
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = { authenticate };
