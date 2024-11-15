const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

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
      folder: 'posts', // Folder name in Cloudinary
      public_id: `${req.user.id}-${Date.now()}`, // Unique identifier for the file
      resource_type: 'auto', // Automatically detect the file type (image, video, etc.)
    };
  },
});

// Define file filter (optional: e.g., for image files only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error('Only images are allowed');
    error.status = 400;
    return cb(error, false);
  }
  cb(null, true);
};

// Initialize multer with Cloudinary storage
const upload = multer({ storage, fileFilter });

module.exports = upload;
