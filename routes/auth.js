const express = require('express');
const router = express.Router();
const multer = require('multer');
const { register, login, getCurrentUser } = require('../controllers/authController');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });
router.post('/register', upload.fields([
  { name: 'frontId', maxCount: 1 },
  { name: 'backId', maxCount: 1 }
]), register);
router.post('/login', login);
router.get('/me', auth, getCurrentUser);

module.exports = router; 