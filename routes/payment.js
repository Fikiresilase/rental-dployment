const express = require('express');
const { paymentChecker, initiatePayment } = require('../controllers/paymentController');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/verify-payment/:id', auth, paymentChecker);
router.post('/initiate-payment', auth, initiatePayment);

module.exports = router;