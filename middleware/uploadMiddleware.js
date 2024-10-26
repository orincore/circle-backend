// uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define storage settings for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = `./uploads/posts/${req.user.id}`;
    
    // Ensure that the directory exists
    fs.mkdirSync(uploadPath, { recursive: true });
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + path.basename(file.originalname));
  }
});

// Define file filter (optional: e.g., for image files)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error('Only images are allowed');
    error.status = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

module.exports = upload;
