const express = require('express');
const router = express.Router();
const {
  createDeal,
  getDealStatus,
  signDeal,
  getUserDeals,
  getDeal,
  updateDealStatus,
  addPayment,
  addReview,
} = require('../controllers/dealController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');

router.use(auth);

// Get all deals for the authenticated user
router.get('/', getUserDeals);

// Get a specific deal by ID
router.get('/:id', getDeal);

// Get deal status for a property
router.get('/status/:propertyId', getDealStatus);

// Create a new deal
router.post('/', createDeal);

// Sign a deal (supporting both POST and PUT for compatibility)
router.post('/sign', signDeal);
router.put('/sign', signDeal);

// Update deal status
router.put('/:id/status', updateDealStatus);

// Add a payment to a deal (restricted to users)
router.post('/:id/payments', checkRole('user'), addPayment);

// Add a review to a deal
router.post('/:id/reviews', addReview);

module.exports = router;