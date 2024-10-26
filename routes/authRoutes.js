const express = require('express');
const {
    register,
    verifyOTP,
    forgotPassword,
    verifyOTPForPasswordReset,
    login,
    checkEmail
  } = require('../controllers/authController'); // Ensure the path is correct

const router = express.Router();

// User registration route
router.post('/register', register);

// OTP verification route
router.post('/verify-otp', verifyOTP);

// Forgot password routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp-password', verifyOTPForPasswordReset);

// User login route
router.post('/login', login);

// Email check route
router.post('/check-email', checkEmail);


module.exports = router;
