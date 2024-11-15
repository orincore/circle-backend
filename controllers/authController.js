const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

// Predefined interests
const interestsList = [
  {
    category: "Travel",
    subcategories: [
      "Adventure Travel",
      "Cultural Exploration",
      "Beach Vacations",
      "Mountain Hiking",
      "City Breaks",
      "Road Trips",
    ],
  },
  {
    category: "Food & Drink",
    subcategories: [
      "Cooking",
      "Baking",
      "Wine Tasting",
      "Craft Beer",
      "Foodie Adventures",
      "Vegan Cooking",
    ],
  },
  {
    category: "Fitness & Health",
    subcategories: [
      "Yoga",
      "Running",
      "Weightlifting",
      "Cycling",
      "Pilates",
      "Meditation",
    ],
  },
  {
    category: "Arts & Entertainment",
    subcategories: [
      "Photography",
      "Movies",
      "Theater",
      "Live Music",
      "Comedy",
      "Writing",
    ],
  },
  {
    category: "Sports",
    subcategories: [
      "Football",
      "Basketball",
      "Tennis",
      "Swimming",
      "Martial Arts",
      "Rock Climbing",
    ],
  },
  {
    category: "Technology & Gaming",
    subcategories: [
      "Video Games",
      "Board Games",
      "Tech Gadgets",
      "Programming",
      "Virtual Reality",
      "E-sports",
    ],
  },
  {
    category: "Lifestyle",
    subcategories: [
      "Gardening",
      "Interior Design",
      "Fashion",
      "Sustainable Living",
      "Volunteering",
      "Collecting",
    ],
  },
  {
    category: "Education & Learning",
    subcategories: [
      "Reading",
      "Online Courses",
      "Language Learning",
      "History",
      "Science",
      "Podcasts",
    ],
  },
  {
    category: "Outdoor Activities",
    subcategories: [
      "Camping",
      "Fishing",
      "Hiking",
      "Skiing",
      "Surfing",
      "Wildlife Watching",
    ],
  },
];
// PostgreSQL Pool Configuration
const pool = new Pool({
  user: process.env.NEON_USER,
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,
  ssl: { rejectUnauthorized: false },
});

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Utility Functions
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = (email, otp) =>
  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your OTP for Circle App",
    text: `Your OTP for verification is ${otp}. It will expire in 10 minutes.`,
  });

// **User Registration**
exports.register = async (req, res) => {
  const { firstname, lastname, email, password, username, gender, dateOfBirth, interests } = req.body;

  try {
    if (!firstname || !lastname || !email || !password || !username || !gender || !dateOfBirth) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const [usernameResult, emailResult] = await Promise.all([
      pool.query("SELECT * FROM users WHERE username = $1", [username]),
      pool.query("SELECT * FROM users WHERE email = $1", [email]),
    ]);

    if (usernameResult.rows.length) return res.status(400).json({ error: "Username is already taken." });
    if (emailResult.rows.length) return res.status(400).json({ error: "Email already registered. Please login." });

    const validInterests = interestsList.flatMap((category) => category.subcategories.map((sub) => sub.toLowerCase()));
    const selectedInterests = (interests || [])
      .slice(0, 5)
      .filter((interest) => validInterests.includes(interest.toLowerCase()));

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query("INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, $3)", [email, otp, expiresAt]);

    await sendOTPEmail(email, otp);

    res.status(200).json({ message: "OTP sent to email. Please verify to complete registration." });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// **Verify OTP**
exports.verifyOTP = async (req, res) => {
  const { email, otp, password, username, firstname, lastname, gender, dateOfBirth, interests } = req.body;

  try {
    if (!email || !otp || !password || !username) {
      return res.status(400).json({ error: "Email, OTP, password, and username are required." });
    }

    const otpResult = await pool.query("SELECT * FROM otps WHERE email = $1 AND otp = $2", [email, otp]);

    if (!otpResult.rows.length || new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const uniqueId = uuidv4();
    const validInterests = interestsList.flatMap((category) => category.subcategories.map((sub) => sub.toLowerCase()));
    const selectedInterests = (interests || [])
      .slice(0, 5)
      .filter((interest) => validInterests.includes(interest.toLowerCase()));

    await pool.query(
      `INSERT INTO users (firstname, lastname, email, password, username, unique_id, gender, date_of_birth, interests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [firstname, lastname, email, hashedPassword, username, uniqueId, gender, dateOfBirth, selectedInterests]
    );

    await pool.query("DELETE FROM otps WHERE email = $1 AND otp = $2", [email, otp]);

    res.status(201).json({ message: "User registered successfully. Please login." });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// **Login**
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const userQuery = "SELECT * FROM users WHERE email = $1";
    const userResult = await pool.query(userQuery, [email]);

    if (!userResult.rows.length) {
      return res.status(400).json({ error: "User not found." });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ id: user.id, uniqueId: user.unique_id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// **Forgot Password**
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const userQuery = "SELECT * FROM users WHERE email = $1";
    const userResult = await pool.query(userQuery, [email]);

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3`,
      [email, otp, expiresAt]
    );

    await sendOTPEmail(email, otp);

    res.status(200).json({ message: "OTP sent to email. Please verify to reset password." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// **Verify OTP for Password Reset**
exports.verifyOTPForPasswordReset = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password are required." });
    }

    const otpResult = await pool.query("SELECT * FROM otps WHERE email = $1 AND otp = $2", [email, otp]);

    if (!otpResult.rows.length || new Date(otpResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);
    await pool.query("DELETE FROM otps WHERE email = $1 AND otp = $2", [email, otp]);

    res.status(200).json({ message: "Password reset successfully. Please login." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// **Resend OTP**
exports.resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO otps (email, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3`,
      [email, otp, expiresAt]
    );

    await sendOTPEmail(email, otp);

    res.status(200).json({ message: "OTP resent to email." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// **Deactivate Account**
exports.deactivateAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    await pool.query("UPDATE users SET is_active = false WHERE id = $1", [userId]);
    res.status(200).json({ message: "Account deactivated successfully." });
  } catch (error) {
    console.error("Deactivate Account Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// **Check if Email is Registered**
exports.checkEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const emailResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    res.status(200).json({ exists: emailResult.rows.length > 0 });
  } catch (error) {
    console.error("Check Email Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
