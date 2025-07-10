const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
  sendOtp,
} = require('../controllers/authController');
const auth = require('../middleware/auth');

// Use /tmp/uploads for Render
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename to avoid spaces and special characters
    const sanitizedFileName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();
    cb(null, `${Date.now()}-${sanitizedFileName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'frontId', maxCount: 1 },
  { name: 'backId', maxCount: 1 },
]);

router.post('/register', upload, register);
router.post('/login', login);
router.get('/me', auth, getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

module.exports = router;