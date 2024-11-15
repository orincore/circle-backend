const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define Cloudinary storage settings
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "posts", // Folder name in Cloudinary
      public_id: `${req.user ? req.user.id : "guest"}-${Date.now()}`, // Unique identifier for the file
      resource_type: "auto", // Automatically detect the file type (image, video, etc.)
    };
  },
});

// Define file filter (optional: e.g., for image files only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error("Only JPEG, PNG, and GIF images are allowed.");
    error.status = 400;
    return cb(error, false);
  }
  cb(null, true);
};

// Initialize multer with Cloudinary storage
const upload = multer({ storage, fileFilter });

// Handle Multer errors (optional middleware)
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // Handle other errors
    return res
      .status(err.status || 500)
      .json({ error: err.message || "Unknown error occurred during file upload." });
  }
  next();
};

// Authenticate middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
  if (!token) {
    return res.status(401).json({ error: "Authorization token required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user information to the request object
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

module.exports = { upload, multerErrorHandler, authenticate };
