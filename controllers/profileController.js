const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;
const notificationService = require("../services/notificationService");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure PostgreSQL
const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

// **1. Fetch Current User's Profile**
const getUserProfile = async (req, res) => {
  try {
    const uniqueId = req.user.uniqueId;

    const query = `
      SELECT 
        u.id, 
        u.unique_id, 
        u.username, 
        u.firstname, 
        u.lastname, 
        u.bio, 
        u.profile_picture, 
        u.email, 
        u.gender, 
        u.date_of_birth, 
        u.created_at,
        u.interests,
        COUNT(DISTINCT p.id) AS total_posts,
        COUNT(DISTINCT f1.follower_id) AS followers_count,
        COUNT(DISTINCT f2.following_id) AS following_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      LEFT JOIN followers f1 ON f1.following_id = u.id
      LEFT JOIN followers f2 ON f2.follower_id = u.id
      WHERE u.unique_id = $1
      GROUP BY u.id;
    `;
    const result = await pool.query(query, [uniqueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// **2. Update Profile Details**
const updateUserProfile = async (req, res) => {
  try {
    const uniqueId = req.user.uniqueId;
    const { username, firstname, lastname, bio, interests, gender, date_of_birth } = req.body;

    const updateQuery = `
      UPDATE users 
      SET 
        username = COALESCE($1, username), 
        firstname = COALESCE($2, firstname), 
        lastname = COALESCE($3, lastname), 
        bio = COALESCE($4, bio), 
        interests = COALESCE($5, interests), 
        gender = COALESCE($6, gender), 
        date_of_birth = COALESCE($7, date_of_birth)
      WHERE unique_id = $8 
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      username,
      firstname,
      lastname,
      bio,
      interests,
      gender,
      date_of_birth,
      uniqueId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await notificationService.sendToUser(req.user.id, 'Your profile has been updated successfully.');

    res.status(200).json({ message: 'Profile updated successfully.', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// **3. Fetch Another User's Profile**
const getUserProfileById = async (req, res) => {
  try {
    const { uniqueId } = req.params;

    const query = `
      SELECT 
        u.id, 
        u.unique_id, 
        u.username, 
        u.firstname, 
        u.lastname, 
        u.bio, 
        u.profile_picture, 
        u.created_at,
        COUNT(DISTINCT p.id) AS total_posts,
        COUNT(DISTINCT f1.follower_id) AS followers_count,
        COUNT(DISTINCT f2.following_id) AS following_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      LEFT JOIN followers f1 ON f1.following_id = u.id
      LEFT JOIN followers f2 ON f2.follower_id = u.id
      WHERE u.unique_id = $1
      GROUP BY u.id;
    `;
    const result = await pool.query(query, [uniqueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { uniqueId } = req.params;

    const query = `
      SELECT 
        p.id AS post_id, 
        p.text, 
        p.media, 
        p.post_type, 
        p.aspect_ratio, 
        p.created_at, 
        u.username, 
        u.profile_picture,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM shares WHERE post_id = p.id) AS shares_count
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE u.unique_id = $1
      ORDER BY p.created_at DESC;
    `;

    const result = await pool.query(query, [uniqueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No posts found for this user." });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// **4. Toggle Follow**
const toggleFollow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const { followingId } = req.body;

    if (followerId === followingId) {
      return res.status(400).json({ message: "You cannot follow yourself." });
    }

    const checkQuery = `SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2;`;
    const checkResult = await pool.query(checkQuery, [followerId, followingId]);

    if (checkResult.rows.length > 0) {
      await pool.query(`DELETE FROM followers WHERE follower_id = $1 AND following_id = $2;`, [followerId, followingId]);
      return res.status(200).json({ message: "Unfollowed successfully." });
    } else {
      await pool.query(`INSERT INTO followers (follower_id, following_id) VALUES ($1, $2);`, [followerId, followingId]);

      await notificationService.sendToUser(followingId, `${req.user.username} has started following you.`);
      return res.status(200).json({ message: "Followed successfully." });
    }
  } catch (error) {
    console.error("Error toggling follow:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// **5. Fetch Activity Feed**
const getActivityFeed = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    const query = `
      SELECT p.*, u.username, u.profile_picture 
      FROM posts p 
      INNER JOIN users u ON p.user_id = u.id 
      WHERE p.user_id IN (
        SELECT following_id FROM followers WHERE follower_id = $1
      ) 
      ORDER BY p.created_at DESC 
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query(query, [userId, limit, offset]);

    res.status(200).json({ posts: result.rows });
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  getUserProfile,
  getUserProfileById,
  updateUserProfile,
  toggleFollow,
  getActivityFeed,
  getUserPosts,
};
