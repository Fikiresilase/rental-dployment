const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['villa', 'condo', 'apartment', 'other'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  floors: {
    type: Number,
    required: true,
    min: 1
  },
  images: [{
    url: String,
    publicId: String
  }],
  amenities: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['available', 'rented', 'pending'],
    default: 'available'
  },
  specifications: {
    bedrooms: {
      type: Number,
      required: true,
      min: 0
    },
    bathrooms: {
      type: Number,
      required: true,
      min: 0
    },
    area: {
      type: Number,
      required: true,
      min: 0
    },
    parking: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for search functionality
propertySchema.index({ 
  title: 'text', 
  description: 'text',
  'location.address': 'text',
  'location.city': 'text'
});

const Property = mongoose.model('Property', propertySchema);

module.exports = Property; 