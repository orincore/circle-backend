const express = require("express");
const {
  register,
  verifyOTP,
  forgotPassword,
  verifyOTPForPasswordReset,
  login,
  checkEmail,
  deactivateAccount, // Newly added feature
} = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware"); // For protected routes

const router = express.Router();

// **Auth Routes**
router.post("/register", register); // Register a new user
router.post("/verify-otp", verifyOTP); // Verify OTP during registration
router.post("/forgot-password", forgotPassword); // Request OTP for password reset
router.post("/verify-otp-password", verifyOTPForPasswordReset); // Verify OTP for password reset
router.post("/login", login); // Login a user
router.post("/check-email", checkEmail); // Check if email is registered

// **Protected Routes**
router.delete("/deactivate-account", authenticate, deactivateAccount); // Deactivate user account

module.exports = router;
