const mongoose = require('mongoose');

const publicKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  publicKey: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

publicKeySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PublicKey = mongoose.model('PublicKey', publicKeySchema);

module.exports = PublicKey;