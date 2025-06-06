const crypto = require('crypto');
const PublicKey = require('../models/PublicKey');

class CryptoService {
  static async verifySignature(userId, data, signature) {
    try {
      const publicKeyEntry = await PublicKey.findOne({ userId });
      if (!publicKeyEntry) {
        throw new Error('Public key not found for user');
      }

      const dealString = JSON.stringify(data);
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(dealString);
      const isValid = verifier.verify(publicKeyEntry.publicKey, signature, 'hex');
      return isValid;
    } catch (error) {
      console.error('Error verifying signature:', {
        userId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Signature verification failed');
    }
  }
}

module.exports = CryptoService;