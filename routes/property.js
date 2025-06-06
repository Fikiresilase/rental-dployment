const express = require('express');
const router = express.Router();
const {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty, 
  searchProperties
} = require('../controllers/propertyController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');

router.get('/', (req, res, next) => {
  if (req.query.ownerOnly === 'true') {
    return auth(req, res, next);
  }
  next();
}, getProperties);
router.get('/search', searchProperties);
router.get('/:id', getProperty);

router.post('/', auth, checkRole('owner', 'admin'), createProperty);
router.put('/:id', auth, checkRole('owner', 'admin'), updateProperty);
router.delete('/:id', auth, checkRole('owner', 'admin'), deleteProperty);

module.exports = router; 