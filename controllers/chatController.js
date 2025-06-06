const Message = require('../models/Message');
const User = require('../models/User');
const Property = require('../models/Property');
const mongoose = require('mongoose');

const getChatHistory = async (req, res) => {
  try {
    const { propertyId, userId, receiverId } = req.params;

    
    if (!propertyId || !userId || !receiverId) {
      return res.status(400).json({ message: 'Property ID, User ID, and Receiver ID are required' });
    }

    
    const messages = await Message.find({
      propertyId,
      $or: [
        { senderId: userId, receiverId: receiverId },
        { senderId: receiverId, receiverId: userId }
      ]
    })
      .sort({ createdAt: 1 }) 
      .populate('senderId', 'email profile') 
      .populate('receiverId', 'email profile'); 

    console.log('Chat history fetched:', {
      messageCount: messages.length,
      propertyId,
      userId,
      receiverId,
      timestamp: new Date().toISOString(),
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', {
      error: error.message,
      propertyId: req.params.propertyId,
      userId: req.params.userId,
      receiverId: req.params.receiverId,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error fetching chat history', error: error.message });
  }
};


const getConversations = async (req, res) => {
  try {
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: req.user._id },
            { receiverId: req.user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', req.user._id] },
              { propertyId: '$propertyId', userId: '$receiverId' },
              { propertyId: '$propertyId', userId: '$senderId' }
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user'
        } 
      },
      {
        $lookup: {
          from: 'properties',
          localField: '_id.propertyId',
          foreignField: '_id',
          as: 'property'
        }
      },
      {
        $project: {
          _id: 0,
          propertyId: '$_id.propertyId',
          userId: '$_id.userId',
          lastMessage: 1,
          user: { $arrayElemAt: ['$user', 0] },
          property: { $arrayElemAt: ['$property', 0] }
        }
      }
    ]);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
};


const markAsRead = async (req, res) => {
  try {
    const { propertyId, userId } = req.params;
    
    await Message.updateMany(
      {
        propertyId,
        senderId: userId,
        receiverId: req.user._id,
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking messages as read', error: error.message });
  }
};


const getChatRequestCounts = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('Getting chat request counts for user:', userId);
    
    
    const properties = await Property.find({ ownerId: userId });
    console.log('Found properties:', properties);
    const propertyIds = properties.map(p => p._id);
    console.log('Property IDs:', propertyIds);

    
    const counts = {};
    for (const propertyId of propertyIds) {
      
      const uniqueUsers = await Message.aggregate([
        {
          $match: {
            propertyId: propertyId,
            senderId: { $ne: userId } 
          }
        },
        {
          $group: {
            _id: '$senderId' 
          }
        },
        {
          $count: 'totalUsers' 
        }
      ]);

      console.log(`Unique users for property ${propertyId}:`, uniqueUsers);
      counts[propertyId] = uniqueUsers[0]?.totalUsers || 0;
    }

    console.log('Final counts:', counts);
    res.json(counts);
  } catch (error) {
    console.error('Error getting chat request counts:', error);
    res.status(500).json({ message: 'Error getting chat request counts', error: error.message });
  }
};

const getChatRequesters = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { userId } = req.query;

    if (!propertyId) {
      return res.status(400).json({ message: 'Property ID is required' });
    }
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
   

    
    const senderIds = await Message.find({
      propertyId,
      receiverId: userId
    }).distinct('senderId');

    console.log('Sender IDs found:', {
      propertyId,
      userId,
      senderCount: senderIds.length,
      senderIds,
      timestamp: new Date().toISOString(),
    });

    
    const requesters = await User.find({ _id: { $in: senderIds } })
      .select('_id name profile.avatar')
      .lean();

    console.log('Chat requesters fetched:', {
      propertyId,
      userId,
      requesterCount: requesters.length,
      timestamp: new Date().toISOString(),
    });

    res.json(requesters);
  } catch (error) {
    console.error('Error fetching chat requesters:', {
      error: error.message,
      propertyId: req.params.propertyId,
      userId: req.query.userId,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error fetching chat requesters', error: error.message });
  }
};


const addTestMessages = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const ownerId = req.user._id;
    
    
    const testUsers = await User.find({ role: 'user' }).limit(3);
    
    
    const messages = testUsers.map(user => ({
      propertyId,
      senderId: user._id,
      receiverId: ownerId,
      content: `Test message from ${user.email}`,
      read: false
    }));
    
    await Message.insertMany(messages);
    
    res.json({ message: 'Test messages added successfully', count: messages.length });
  } catch (error) {
    console.error('Error adding test messages:', error);
    res.status(500).json({ message: 'Error adding test messages', error: error.message });
  }
};


const createMessage = async (req, res) => {
  console.log(req.body);
  try {
    const { senderId, receiverId, propertyId, content } = req.body;
    const message = new Message({
      senderId,
      receiverId,
      propertyId,
      content,
      read: false, 
    });
    let savedMessage = await message.save();
    
    
    savedMessage = await Message.findById(savedMessage._id)
      .populate([
        { path: 'senderId', select: 'email profile' },
        { path: 'receiverId', select: 'email profile' }
      ]);

    if (!savedMessage) {
      throw new Error('Failed to populate message');
    }

    res.status(201).json(savedMessage);

    
    const io = req.app.get('io');
    if (io) {
      io.to(`property:${propertyId}`).emit('chat', { type: 'chat', message: savedMessage });
    } else {
      console.warn('Socket.IO not initialized');
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error creating message', error: error.message });
  }
};

module.exports = {
  getChatHistory,
  getConversations,
  markAsRead,
  getChatRequestCounts,
  getChatRequesters,
  createMessage,
  addTestMessages
};