const { Pool } = require("pg");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");
const notificationService = require("../services/notificationService");
const { v4: uuidv4 } = require("uuid");
const nodeCron = require("node-cron");

const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,
  ssl: { rejectUnauthorized: false },
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = file.mimetype.startsWith("video/") ? "circle_posts/videos" : "circle_posts/images";
    const resourceType = file.mimetype.startsWith("video/") ? "video" : "image";

    return {
      folder,
      resource_type: resourceType,
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov"],
    };
  },
});

const upload = multer({ storage });
const uploadMiddleware = upload.single("media");

const fetchPostDetails = async (postId) => {
  const query = `
    SELECT p.*, 
           u.username, 
           u.profile_picture, 
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count, 
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count, 
           (SELECT COUNT(*) FROM shares WHERE post_id = p.id) AS shares_count
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = $1;
  `;
  const result = await pool.query(query, [postId]);
  return result.rows[0];
};

// Create Post
const createPost = async (req, res) => {
  try {
    const { postType, text, aspectRatio } = req.body;
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.id;

    if (!["text", "image", "video"].includes(postType)) {
      return res.status(400).json({ error: "Invalid post type" });
    }

    let mediaUrl = null;
    if (postType !== "text" && req.file) {
      mediaUrl = req.file.path;
    } else if (postType === "text" && (!text || text.trim() === "")) {
      return res.status(400).json({ error: "Text content is required for a text post." });
    }

    const interestsQuery = `SELECT interests FROM users WHERE id = $1;`;
    const userInterestsResult = await pool.query(interestsQuery, [userId]);
    const userInterests = userInterestsResult.rows[0]?.interests || [];

    const uniqueId = uuidv4();

    const insertQuery = `
      INSERT INTO posts (user_id, unique_id, post_type, text, media, aspect_ratio, interests, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id;
    `;
    const result = await pool.query(insertQuery, [
      userId,
      uniqueId,
      postType,
      text || null,
      mediaUrl,
      aspectRatio,
      userInterests,
    ]);

    const post = await fetchPostDetails(result.rows[0].id);

    await notificationService.sendToFollowers(userId, `${req.user.username} created a new ${postType} post!`);
    res.status(201).json({ message: "Post created successfully", post });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch Posts by Type
const getPostsByType = async (req, res) => {
  const { type } = req.query;
  const { page = 1, limit = 10 } = req.query;

  try {
    if (!["image", "video", "text"].includes(type)) {
      return res.status(400).json({ error: "Invalid post type" });
    }

    const offset = (page - 1) * limit;
    const query = `
      SELECT p.*, u.username, u.profile_picture
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.post_type = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const posts = await pool.query(query, [type, limit, offset]);

    res.status(200).json({ posts: posts.rows });
  } catch (error) {
    console.error("Error fetching posts by type:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Like/Unlike a Post
const toggleLike = async (req, res) => {
  const { postId } = req.params;
  try {
    const userId = req.user.id;
    const checkLikeQuery = `SELECT * FROM likes WHERE post_id = $1 AND user_id = $2;`;
    const likeExists = await pool.query(checkLikeQuery, [postId, userId]);

    if (likeExists.rows.length > 0) {
      await pool.query(`DELETE FROM likes WHERE post_id = $1 AND user_id = $2;`, [postId, userId]);
      return res.status(200).json({ message: "Post unliked successfully" });
    } else {
      await pool.query(`INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, NOW());`, [
        postId,
        userId,
      ]);
      return res.status(201).json({ message: "Post liked successfully" });
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Add Comment to a Post
const addComment = async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;

  try {
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Comment text is required." });
    }

    const userId = req.user.id;

    const insertCommentQuery = `
      INSERT INTO comments (post_id, user_id, text, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `;
    const result = await pool.query(insertCommentQuery, [postId, userId, text]);

    res.status(201).json({ message: "Comment added successfully", comment: result.rows[0] });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Share a Post
const sharePost = async (req, res) => {
  const { postId } = req.params;
  try {
    const userId = req.user.id;
    await pool.query(`INSERT INTO shares (post_id, user_id, created_at) VALUES ($1, $2, NOW());`, [
      postId,
      userId,
    ]);

    res.status(201).json({ message: "Post shared successfully" });
  } catch (error) {
    console.error("Error sharing post:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete Post
const deletePost = async (req, res) => {
  const { postId } = req.params;
  try {
    const query = `DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING *;`;
    const result = await pool.query(query, [postId, req.user.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post not found or unauthorized access" });
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch Comments for a Post
const getCommentsForPost = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const offset = (page - 1) * limit;

    const query = `
      SELECT c.id, c.text, c.created_at, 
             u.username, u.profile_picture
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const result = await pool.query(query, [postId, limit, offset]);

    res.status(200).json({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: result.rowCount,
      comments: result.rows,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete Comment
const deleteComment = async (req, res) => {
  const { commentId } = req.params;

  try {
    const userId = req.user.id; // Authenticated user's ID

    // Check if the comment exists and fetch its details
    const commentQuery = `
      SELECT c.post_id, c.user_id AS comment_owner_id, p.user_id AS post_owner_id
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id
      WHERE c.id = $1;
    `;
    const commentResult = await pool.query(commentQuery, [commentId]);

    if (commentResult.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const { post_owner_id, comment_owner_id } = commentResult.rows[0];

    // Check if the authenticated user is the post owner or the comment owner
    if (userId !== post_owner_id && userId !== comment_owner_id) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }

    // Delete the comment
    const deleteQuery = `DELETE FROM comments WHERE id = $1;`;
    await pool.query(deleteQuery, [commentId]);

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Save a Post
const savePost = async (req, res) => {
  const { postId } = req.params;
  try {
    const userId = req.user.id;

    await pool.query(
      `INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [userId, postId]
    );

    res.status(201).json({ message: "Post saved successfully." });
  } catch (error) {
    console.error("Error saving post:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// Fetch Saved Posts
const getSavedPosts = async (req, res) => {
  const userId = req.user.id;
  try {
    const query = `
      SELECT p.*, u.username, u.profile_picture 
      FROM saved_posts sp
      JOIN posts p ON sp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1
      ORDER BY sp.saved_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    res.status(200).json({ posts: result.rows });
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// Report a Post
const reportPost = async (req, res) => {
  const { postId } = req.params;
  const { reason } = req.body;

  try {
    const userId = req.user.id;

    await pool.query(
      `INSERT INTO reports (post_id, reported_by_user_id, reason) VALUES ($1, $2, $3);`,
      [postId, userId, reason]
    );

    res.status(201).json({ message: "Post reported successfully." });
  } catch (error) {
    console.error("Error reporting post:", error);
    res.status(500).json({ error: "Server error." });
  }
};

// Fetch Reports (Admin Only)
const getReports = async (req, res) => {
  try {
    const reportsQuery = `
      SELECT r.*, p.text AS post_text, p.media AS post_media, u.username AS reported_by
      FROM reports r
      JOIN posts p ON r.post_id = p.id
      JOIN users u ON r.reported_by_user_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC;
    `;

    const reports = await pool.query(reportsQuery);
    res.status(200).json({ reports: reports.rows });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Server error." });
  }
};


module.exports = {
  uploadMiddleware,
  createPost,
  getPostsByType,
  toggleLike,
  addComment,
  getSavedPosts,
  sharePost,
  reportPost,
  deletePost,
  getCommentsForPost,
  deleteComment,
  getReports,
  savePost,
};
