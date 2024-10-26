const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Import UUID for unique ID generation
const nodemailer = require('nodemailer'); // For sending OTP via email
const User = require('../models/User'); // Mongoose User model
const Otp = require('../models/Otp');
const moment = require('moment');
const useragent = require('user-agent');
const geoip = require('geoip-lite');




// Predefined list of interests
const interestsList = [
  {
    category: "Travel",
    subcategories: [
      "Adventure Travel",
      "Cultural Exploration",
      "Beach Vacations",
      "Mountain Hiking",
      "City Breaks",
      "Road Trips"
    ]
  },
  {
    category: "Food & Drink",
    subcategories: [
      "Cooking",
      "Baking",
      "Wine Tasting",
      "Craft Beer",
      "Foodie Adventures",
      "Vegan Cooking"
    ]
  },
  {
    category: "Fitness & Health",
    subcategories: [
      "Yoga",
      "Running",
      "Weightlifting",
      "Cycling",
      "Pilates",
      "Meditation"
    ]
  },
  {
    category: "Arts & Entertainment",
    subcategories: [
      "Photography",
      "Movies",
      "Theater",
      "Live Music",
      "Comedy",
      "Writing"
    ]
  },
  {
    category: "Sports",
    subcategories: [
      "Football",
      "Basketball",
      "Tennis",
      "Swimming",
      "Martial Arts",
      "Rock Climbing"
    ]
  },
  {
    category: "Technology & Gaming",
    subcategories: [
      "Video Games",
      "Board Games",
      "Tech Gadgets",
      "Programming",
      "Virtual Reality",
      "E-sports"
    ]
  },
  {
    category: "Lifestyle",
    subcategories: [
      "Gardening",
      "Interior Design",
      "Fashion",
      "Sustainable Living",
      "Volunteering",
      "Collecting"
    ]
  },
  {
    category: "Education & Learning",
    subcategories: [
      "Reading",
      "Online Courses",
      "Language Learning",
      "History",
      "Science",
      "Podcasts"
    ]
  },
  {
    category: "Outdoor Activities",
    subcategories: [
      "Camping",
      "Fishing",
      "Hiking",
      "Skiing",
      "Surfing",
      "Wildlife Watching"
    ]
  }
];


// Nodemailer setup for sending OTPs
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP Email
const sendOTPEmail = (email, otp) => {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM, // Sender email address from .env
    to: email, // User email
    subject: 'Your OTP for Circle App', // Email subject
    text: `Your OTP for verification is ${otp}. It will expire in 10 minutes.`,
  });
};


// Registration logic (Step 1: Generate OTP and store it in MongoDB)
exports.register = async (req, res) => {
  const { firstname, lastname, email, password, username, gender, dateOfBirth, interests } = req.body;

  // Validate fields
  if (!firstname || !lastname || !email || !password || !username || !gender || !dateOfBirth) {
    return res.status(400).send({ error: 'All fields are required.' });
  }

  // Check if username is already taken
  const existingUserByUsername = await User.findOne({ username });
  if (existingUserByUsername) {
    return res.status(400).send({ error: 'Username is already taken. Please choose another one.' });
  }

  // Validate interests
  if (interests && Array.isArray(interests)) {
    const validInterests = interestsList
      .flatMap(interest => interest.subcategories)
      .map(interest => interest.toLowerCase().trim());

    const selectedInterests = interests
      .slice(0, 5)
      .map(interest => interest.toLowerCase().trim())
      .filter(interest => validInterests.includes(interest));

    if (selectedInterests.length < interests.length) {
      return res.status(400).send({
        error: 'Some interests are not valid. Please select from the available options.',
        validInterests: interestsList.flatMap(interest => interest.subcategories),
      });
    }
  }

  // Check if email is already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send({ error: 'Email already registered. Please login.' });
  }

  // Generate OTP and save it
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
  await Otp.create({ email, otp, expiresAt });

  // Send OTP
  try {
    await sendOTPEmail(email, otp);
    res.status(200).send({ message: 'OTP sent to email. Please verify to complete registration.' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send({ error: 'Failed to send OTP. Try again later.' });
  }
};

// Verify OTP and complete registration (Step 2: OTP Verification)
// Verify OTP and complete registration (Step 2: OTP Verification)
exports.verifyOTP = async (req, res) => {
  const { email, otp, password, username } = req.body; // Include username

  // Check if OTP, email, password, and username are provided
  if (!email || !otp || !password || !username) {
    return res.status(400).send({ error: 'Email, OTP, password, and username are required.' });
  }

  // Check OTP in MongoDB
  const otpRecord = await Otp.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).send({ error: 'Invalid OTP or email.' });
  }

  // Check if OTP is expired
  if (otpRecord.expiresAt < new Date()) {
    return res.status(400).send({ error: 'OTP has expired. Please request a new one.' });
  }

  try {
    // Check if username is already taken
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      return res.status(400).send({ error: 'Username is already taken. Please choose another one.' });
    }

    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(password, 10);
    const uniqueId = uuidv4();

    const { firstname, lastname, gender, dateOfBirth, interests } = req.body; // Add these fields to req body
    const user = new User({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      username, // Store the username
      uniqueId,
      gender,
      dateOfBirth,
      interests: interests ? interests.slice(0, 5) : [],
    });

    await user.save();

    // Remove OTP after successful registration
    await Otp.deleteOne({ email, otp });

    res.status(201).send({ message: 'User registered successfully. Please login.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send({ error: 'Failed to register user.' });
  }
};

// Login logic
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, uniqueId: user.uniqueId }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Store the token in MongoDB
    user.tokens = user.tokens.concat({ token });
    await user.save();

    // Get user agent info
    const ua = useragent.parse(req.headers['user-agent']);
    const osInfo = `${ua.os.name} ${ua.os.version}`;
    const deviceInfo = ua.device && ua.device.type ? `${ua.device.type} - ${ua.device.model}` : 'Unknown Device';

    // Get user's IP address and location
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',').shift();
    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city}, ${geo.region}, ${geo.country}` : 'Unknown Location';

    // Get the current login time
    const loginTime = moment().format('MMMM Do YYYY, h:mm:ss a'); 

    // Send email notification to the user
const mailOptions = {
  from: process.env.SMTP_USER, // Sender email address
  to: email, // Recipient email address (user's email)
  subject: 'Login Alert!', // Updated subject
  html: `
    <h3>New Login to Your Circle Account</h3> <!-- Updated title -->
    <p>Hello ${user.firstname},</p>
    <p>We detected a new login to your Circle account with the following details:</p>
    <ul>
      <li><strong>Time:</strong> ${loginTime}</li>
      <li><strong>IP Address:</strong> ${ip}</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>Operating System:</strong> ${osInfo}</li>
      <li><strong>Device:</strong> ${deviceInfo}</li>
    </ul>
    <p>If this was you, no further action is needed. If you did not log in, please secure your account immediately.</p>
    <p>Stay safe,</p>
    <p><strong>Circle Security Bot</strong></p> <!-- Updated sign-off -->
    <br>
    <p style="font-size: 12px; color: grey;">Circle - A product by Orincore</p> <!-- Added tagline -->
  `,
};

    await transporter.sendMail(mailOptions);

    // Return the token to the frontend
    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};


// Check if email is already registered
exports.checkEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email });

    if (user) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking email:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Forgot Password - Step 1: Send OTP for password reset
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send({ error: 'Email is required.' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).send({ error: 'User not found.' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
  await Otp.create({ email, otp, expiresAt });

  try {
    await sendOTPEmail(email, otp);
    res.status(200).send({ message: 'OTP sent to email. Please verify to reset password.' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).send({ error: 'Failed to send OTP. Try again later.' });
  }
};

// Forgot Password - Step 2: Verify OTP and Reset Password
exports.verifyOTPForPasswordReset = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).send({ error: 'Email, OTP, and new password are required.' });
  }

  const otpRecord = await Otp.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).send({ error: 'Invalid OTP or email.' });
  }

  if (otpRecord.expiresAt < new Date()) {
    return res.status(400).send({ error: 'OTP has expired. Please request a new one.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    await Otp.deleteOne({ email, otp });

    res.status(200).send({ message: 'Password reset successfully. Please login.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).send({ error: 'Failed to reset password.' });
  }
};

// Logout or revoke token
exports.logout = async (req, res) => {
  try {
    // Remove the current token from the user's tokens array
    await User.updateOne(
      { _id: req.user.id }, // Find the user by ID
      { $pull: { tokens: { token: req.token } } } // Remove the token from the tokens array
    );

    res.status(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send({ error: 'Failed to log out' });
  }
};