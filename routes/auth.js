const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { register, login, getCurrentUser } = require('../controllers/authController');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
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
  limits: { fileSize: 5 * 1024 * 1024 } 
}).fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'frontId', maxCount: 1 },
  { name: 'backId', maxCount: 1 }
]);


router.post('/register', upload, register);
router.post('/login', login);
router.get('/me', getCurrentUser);

module.exports = router;