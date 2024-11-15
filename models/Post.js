const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create a new post
const createPost = async (post) => {
  const query = `
    INSERT INTO posts (user_id, unique_id, post_type, text, media_url, aspect_ratio, interests)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    post.user_id,
    post.unique_id,
    post.post_type,
    post.text || null,
    post.media_url || null,
    post.aspect_ratio || null,
    post.interests || null,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get feed posts based on user interests
const getPostsByInterests = async (interests, limit = 10, offset = 0) => {
  const query = `
    SELECT * FROM posts
    WHERE interests && $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const values = [interests, limit, offset];
  const result = await pool.query(query, values);
  return result.rows;
};

// Delete a post
const deletePost = async (postId) => {
  const query = `DELETE FROM posts WHERE id = $1 RETURNING *;`;
  const values = [postId];
  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
  createPost,
  getPostsByInterests,
  deletePost,
};
