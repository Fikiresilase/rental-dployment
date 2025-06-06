const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection string (replace with your actual connection string)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gebeya-home-rental';
console.log(MONGODB_URI)

// Output file for private keys
const OUTPUT_FILE = path.join(__dirname, 'legacy-keys.json');

// Generate RSA key pair
function generateKeyPair() {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
      (err, publicKey, privateKey) => {
        if (err) reject(err);
        else resolve({ publicKey, privateKey });
      }
    );
  });
}

async function migrateAllLegacyDealKeys() {
  try {
    // Connect to MongoDB
    console.log('Attempting to connect to MongoDB:', { uri: MONGODB_URI, timestamp: new Date().toISOString() });
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB:', { timestamp: new Date().toISOString() });

    // Define schemas
    const dealSchema = new mongoose.Schema({
      ownerId: mongoose.Schema.Types.ObjectId,
      renterId: mongoose.Schema.Types.ObjectId,
    }, { strict: false });
    const publicKeySchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
      publicKey: { type: String, required: true },
    }, { strict: false });

    const Deal = mongoose.model('Deal', dealSchema);
    const PublicKey = mongoose.model('PublicKey', publicKeySchema);

    // Verify deals collection
    const dealsCount = await Deal.countDocuments();
    console.log('Total deals in collection:', { count: dealsCount, timestamp: new Date().toISOString() });
    if (dealsCount === 0) {
      console.warn('No deals found in collection. Exiting migration.', { timestamp: new Date().toISOString() });
      return;
    }

    // Find all deals (all are legacy)
    const allDeals = await Deal.find().select('ownerId renterId').lean();
    console.log('Fetched deals:', { count: allDeals.length, sample: allDeals.slice(0, 5).map(d => ({ ownerId: d.ownerId, renterId: d.renterId })), timestamp: new Date().toISOString() });

    // Extract unique user IDs
    const userIds = new Set();
    allDeals.forEach(deal => {
      if (deal.ownerId && mongoose.Types.ObjectId.isValid(deal.ownerId)) {
        userIds.add(deal.ownerId.toString());
      } else {
        console.warn('Invalid or missing ownerId:', { dealId: deal._id, ownerId: deal.ownerId, timestamp: new Date().toISOString() });
      }
      if (deal.renterId && mongoose.Types.ObjectId.isValid(deal.renterId)) {
        userIds.add(deal.renterId.toString());
      } else {
        console.warn('Invalid or missing renterId:', { dealId: deal._id, renterId: deal.renterId, timestamp: new Date().toISOString() });
      }
    });
    console.log('Unique users in deals:', { count: userIds.size, userIds: Array.from(userIds).slice(0, 5), timestamp: new Date().toISOString() });

    if (userIds.size === 0) {
      console.warn('No valid user IDs found in deals. Exiting migration.', { timestamp: new Date().toISOString() });
      return;
    }

    // Check existing public keys
    const existingKeys = await PublicKey.find({
      userId: { $in: Array.from(userIds).map(id => new mongoose.Types.ObjectId(id)) }
    }).select('userId').lean();
    const usersWithKeys = new Set(existingKeys.map(key => key.userId.toString()));
    console.log('Users with existing keys:', { count: usersWithKeys.size, sample: Array.from(usersWithKeys).slice(0, 5), timestamp: new Date().toISOString() });

    // Users needing keys
    const usersNeedingKeys = Array.from(userIds).filter(id => !usersWithKeys.has(id));
    console.log('Users needing keys:', { count: usersNeedingKeys.length, sample: usersNeedingKeys.slice(0, 5), timestamp: new Date().toISOString() });

    if (usersNeedingKeys.length === 0) {
      console.warn('All users already have public keys. Exiting migration.', { timestamp: new Date().toISOString() });
      return;
    }

    // Generate and store keys
    const keyOutput = [];
    let successCount = 0;
    let errorCount = 0;
    for (const userId of usersNeedingKeys) {
      try {
        const { publicKey, privateKey } = await generateKeyPair();

        // Validate public key format
        if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
          throw new Error('Invalid public key format generated');
        }

        // Store public key
        const publicKeyEntry = new PublicKey({
          userId: new mongoose.Types.ObjectId(userId),
          publicKey,
        });
        await publicKeyEntry.save();

        // Store private key in output
        keyOutput.push({ userId, privateKey });

        successCount++;
        console.log('Generated and saved keys for user:', {
          userId,
          publicKeyId: publicKeyEntry._id,
          publicKeyLength: publicKey.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        errorCount++;
        console.error('Error generating/saving keys for user:', {
          userId,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log('Key generation summary:', {
      attempted: usersNeedingKeys.length,
      successful: successCount,
      failed: errorCount,
      timestamp: new Date().toISOString(),
    });

    // Write private keys to file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(keyOutput, null, 2));
    console.log('Private keys saved to:', {
      file: OUTPUT_FILE,
      count: keyOutput.length,
      timestamp: new Date().toISOString(),
    });

    // Verify public keys
    const newKeys = await PublicKey.find({
      userId: { $in: usersNeedingKeys.map(id => new mongoose.Types.ObjectId(id)) }
    }).select('userId publicKey').lean();
    console.log('New public keys created:', {
      count: newKeys.length,
      sample: newKeys.slice(0, 5).map(k => ({ userId: k.userId, publicKeyLength: k.publicKey.length })),
      timestamp: new Date().toISOString(),
    });

    if (newKeys.length !== successCount) {
      console.warn('Mismatch between saved keys and database entries:', {
        expected: successCount,
        found: newKeys.length,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    console.error('Migration error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB:', { timestamp: new Date().toISOString() });
  }
}

// Run the migration
migrateAllLegacyDealKeys().catch(error => {
  console.error('Unexpected error:', { error: error.message, stack: error.stack });
  process.exit(1);
});