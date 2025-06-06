const express = require('express');
const router = express.Router();
const keyController = require('../controllers/keyController');
const authMiddleware = require('../middleware/auth');


router.post('/', authMiddleware, keyController.storePublicKey);
router.get('/:userId', authMiddleware, keyController.getPublicKey);

module.exports = router;