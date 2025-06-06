const express = require('express');
const router = express.Router();
const keyController = require('../controllers/keyController');
const authMiddleware = require('../middleware/auth');

// Store public key
router.post('/', authMiddleware, keyController.storePublicKey);

// Get public key by user ID
router.get('/:userId', authMiddleware, keyController.getPublicKey);

module.exports = router;