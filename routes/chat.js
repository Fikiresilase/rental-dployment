const express = require('express');
const router = express.Router();
const {
  getChatHistory,
  getConversations,
  markAsRead,
  getChatRequestCounts,
  createMessage,
  getChatRequesters
} = require('../controllers/chatController');
const auth = require('../middleware/auth');
router.use(auth);

router.get('/conversations', getConversations);
router.get('/request-counts', getChatRequestCounts);
router.get('/requesters/:propertyId', getChatRequesters);
router.get('/:propertyId/:userId/:receiverId', getChatHistory);
router.put('/:propertyId/:userId/read', markAsRead);
router.post('/', createMessage);

module.exports = router;