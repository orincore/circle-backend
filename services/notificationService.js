const { Pool } = require('pg');
const admin = require("../config/firebaseConfig"); // Import Firebase Admin SDK

// PostgreSQL Pool Configuration
const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,
  ssl: { rejectUnauthorized: false },
});

/**
 * Send notification to all followers of a user
 * @param {number} userId - The user ID whose followers will receive the notification
 * @param {string} message - The notification message
 */
const sendToFollowers = async (userId, message) => {
  try {
    const followersQuery = `
      SELECT f.follower_id, u.device_token
      FROM followers f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1 AND u.device_token IS NOT NULL;
    `;
    const result = await pool.query(followersQuery, [userId]);

    const deviceTokens = result.rows.map((follower) => follower.device_token);

    if (deviceTokens.length > 0) {
      const payload = {
        notification: {
          title: "New Post Alert",
          body: message,
        },
      };

      const response = await admin.messaging().sendToDevice(deviceTokens, payload);
      console.log(`Notifications sent: ${response.successCount}/${deviceTokens.length}`);
    }

    return { success: true, count: deviceTokens.length };
  } catch (error) {
    console.error("Error sending notifications to followers:", error);
    throw new Error("Failed to send notifications");
  }
};

/**
 * Send notification to a specific user
 * @param {number} userId - The ID of the user who will receive the notification
 * @param {string} message - The notification message
 */
const sendToUser = async (userId, message) => {
  try {
    const userQuery = `
      SELECT device_token 
      FROM users 
      WHERE id = $1 AND device_token IS NOT NULL;
    `;
    const result = await pool.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      console.warn(`No device token found for user ID ${userId}`);
      return { success: false, message: "No device token found." };
    }

    const deviceToken = result.rows[0].device_token;

    const payload = {
      notification: {
        title: "Notification",
        body: message,
      },
    };

    const response = await admin.messaging().sendToDevice(deviceToken, payload);
    console.log(`Notification sent to user ${userId}: ${response.successCount}/1`);

    return { success: true, message: "Notification sent." };
  } catch (error) {
    console.error("Error sending notification to user:", error);
    throw new Error("Failed to send notification");
  }
};

module.exports = { sendToFollowers, sendToUser };
