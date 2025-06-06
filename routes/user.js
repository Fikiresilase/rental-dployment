const express = require('express');
const router = express.Router();
const { getUserById } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/:id', auth, getUserById);

module.exports = router; 