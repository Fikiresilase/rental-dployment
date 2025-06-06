const PublicKey = require('../models/PublicKey');
const crypto = require('crypto');


const validatePublicKey = (publicKey) => {
  try {
    
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('Public key is empty or not a string');
    }
    if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || !publicKey.endsWith('-----END PUBLIC KEY-----')) {
      throw new Error('Public key is not in valid PEM format');
    }

    
    crypto.createPublicKey(publicKey);

    console.log('Public key validation: Success', {
      publicKeySnippet: publicKey.slice(0, 50) + '...',
      publicKeyLength: publicKey.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Public key validation failed:', {
      error: error.message,
      publicKeySnippet: publicKey ? publicKey.slice(0, 50) + 'undefined' : 'error',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};


const storePublicKey = async (req, res) => {
  try {
    const { userId, publicKey } = req.body;
    const authenticatedUserId = req.user?._id?.toString();

    console.log('Received public key storage request:', {
      userId,
      publicKeySnippet: publicKey.slice ? publicKey.slice(0, 50) : 'undefined',
      authenticatedUserId,
      timestamp: new Date().toISOString(),
    });

    
    if (!userId || !publicKey) {
      console.warn('Missing required fields:', {
        userId,
        publicKeyProvided: !!publicKey,
        authenticatedUserId,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'userId and publicKey are required' });
    }

    if (userId !== authenticatedUserId) {
      console.warn('User ID mismatch:', {
        providedUserId: userId,
        authenticatedUserId,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Provided userId does not match authenticated user' });
    }

    
    try {
      validatePublicKey(publicKey);
    } catch (error) {
      console.warn('Public key validation failed:', {
        userId,
        publicKeySnippet: publicKey.slice(0, 50) + '...',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: `Invalid public key: ${error.message}` });
    }

    
    const existingKey = await PublicKey.findOne({ userId });
    if (existingKey) {
      existingKey.publicKey = publicKey;
      await existingKey.save();
      console.log('Public key updated:', {
        userId,
        publicKeySnippet: publicKey.slice(0, 50) + '...',
        timestamp: new Date().toISOString(),
      });
      return res.status(200).json({ message: 'Public key updated successfully' });
    }

    const newKey = new PublicKey({
      userId,
      publicKey,
    });
    await newKey.save();

    console.log('Public key stored:', {
      userId,
      publicKeySnippet: publicKey.slice(0, 50) + '...',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ message: 'Public key stored successfully' });
  } catch (error) {
    console.error('Error storing public key:', {
      userId: req.body.userId,
      error: error.message,
      authenticatedUserId: req.user?._id?.toString(),
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error storing public key', error: error.message });
  }
};


const getPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user?._id?.toString();

    console.log('Received public key retrieval request:', {
      userId,
      authenticatedUserId,
      timestamp: new Date().toISOString(),
    });

    
    if (!userId) {
      console.warn('Missing userId:', {
        authenticatedUserId,
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'userId is required' });
    }

    
    if (userId !== authenticatedUserId) {
      console.warn('User ID mismatch:', {
        providedUserId: userId,
        authenticatedUserId,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Not authorized to access this public key' });
    }

    
    const publicKeyRecord = await PublicKey.findOne({ userId });
    if (!publicKeyRecord) {
      console.warn('Public key not found:', {
        userId,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ message: 'Public key not found for me' });
    }

    console.log('Public key retrieved:', {
      userId,
      publicKeySnippet: publicKeyRecord.publicKey.slice(0, 50) + '...',
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      userId,
      publicKey: publicKeyRecord.publicKey,
    });
  } catch (error) {
    console.error('Error retrieving public key:', {
      userId: req.params.userId,
      error: error.message,
      authenticatedUserId: req.user?._id?.toString(),
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error retrieving public key', error: error.message });
  }
};

module.exports = {
  storePublicKey,
  getPublicKey,
};