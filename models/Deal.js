const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  renterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  monthlyRent: {
    type: Number,
    required: true,
    min: 0
  },
  securityDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'done', 'completed', 'cancelled'],
    default: 'pending'
  },
  terms: {
    type: String,
    required: true
  },
  signatures: {
    owner: {
      signed: { type: Boolean, default: false },
      signedAt: { type: Date },
      signature: { // Added to store signature
        signatureBase64: { type: String }
      }
    },
    renter: {
      signed: { type: Boolean, default: false },
      signedAt: { type: Date },
      signature: { // Added to store signature
        signatureBase64: { type: String }
      }
    }
  },
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: Date
  }],
  payments: [{
    amount: Number,
    dueDate: Date,
    paidAt: Date,
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending'
    },
    paymentMethod: String,
    transactionId: String
  }],
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  timestamp: { // Added for signature verification
    type: String,
    required: false
  }
}, {
  timestamps: true
});

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;