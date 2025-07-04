const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Property = require('../models/Property');
const PublicKey = require('../models/PublicKey');
const CryptoService = require('../services/CryptoService');

const createDeal = async (req, res) => {
  try {
    const { propertyId, ownerId, renterId, startDate, endDate, monthlyRent, securityDeposit, terms, signature, } = req.body;
    const userId = req.user._id;

    console.log('Creating deal:', {
      propertyId,
      ownerId,
      renterId,
      userId,
      timestampLog: new Date().toISOString(),
    });

    if (!propertyId || !ownerId || !startDate || !endDate || !monthlyRent || !securityDeposit || !terms || !signature) {
      console.warn('Missing required fields:', {
        signature,
        propertyId,
        ownerId,
        renterId,
        startDate,
        endDate,
        monthlyRent,
        securityDeposit,
        terms,
        userId,
        timestampLog: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'Property ID, owner ID, start date, end date, monthly rent, security deposit, terms, and timestamp (if signature provided) are required' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      console.warn('Property not found:', { propertyId, userId, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Property not found' });
    }
    if (!['available', 'pending'].includes(property.status)) {
      console.warn('Property not available:', { propertyId, status: property.status, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: `Property is not available for deals (status: ${property.status})` });
    }

    if (property.ownerId.toString() !== ownerId) {
      console.warn('Owner ID mismatch:', { providedOwnerId: ownerId, propertyOwnerId: property.ownerId, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Owner ID does not match property owner' });
    }

    const isOwner = userId.toString() === ownerId.toString();
    if (!isOwner && (!renterId || renterId !== userId.toString())) {
      console.warn('Unauthorized to create deal:', { userId, ownerId, renterId, timestampLog: new Date().toISOString() });
      return res.status(403).json({ message: 'Not authorized to create this deal' });
    }

    const existingDeal = await Deal.findOne({
      propertyId,
      status: { $in: ['pending', 'completed'] },
    });
    if (existingDeal && !(existingDeal.signatures.owner.signed && existingDeal.signatures.renter.signed)) {
      console.warn('Existing  found:', {
        propertyId,
        dealId: existingDeal._id,
        status: existingDeal.status,
        userId,
        timestampLog: new Date().toISOString(),
      });
      return res.json(existingDeal);
    }

    if (signature) {
      const publicKeyRecord = await PublicKey.findOne({ userId });
      if (!publicKeyRecord) {
        console.warn('User public key not found:', { userId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'User public key not found' });
      }
      const dealData = {
        propertyId,
        ownerId,
        renterId: renterId || null,
        terms,
        
      };
      const isValidSignature = await CryptoService.verifySignature(publicKeyRecord.publicKey, dealData, signature, true);
      if (!isValidSignature) {
        console.warn('Invalid signature:', { userId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'Invalid signature provided' });
      }
    }

    const deal = new Deal({
      propertyId,
      ownerId,
      renterId: renterId || null,
      startDate,
      endDate,
      monthlyRent,
      securityDeposit,
      terms,
      status: 'pending',
      signatures: {
        owner: {
          signed: isOwner && signature ? true : 'false',
          signedAt: isOwner && signature ? new Date() : null,
          signature: isOwner && signature ? signature : null,
        },
        renter: {
          signed: !isOwner && signature ? true : false,
          signedAt: !isOwner && signature ? new Date() : null,
          signature: !isOwner && signature ? signature : null,
        },
      },
    });

    await deal.save();
    property.status = 'pending';
    await property.save();

    console.log('Deal created:', {
      dealId: deal._id,
      propertyId,
      ownerId,
      renterId,
      status: deal.status,
      userId,
      timestampLog: new Date().toISOString(),
    });

    const populatedDeal = await Deal.findById(deal._id)
      .populate('propertyId')
      .populate('ownerId', 'name email')
      .populate('renterId', 'name email');

    res.status(201).json(populatedDeal);
  } catch (error) {
    console.error('Error creating deal:', {
      propertyId: req.body.propertyId,
      userId: req.user._id,
      error: error.message,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error creating deal', error: error.message });
  }
};

const signDeal = async (req, res) => {
  try {
    const { dealId, propertyId, ownerId, renterId, userId, signature, terms, timestamp, isCreateDeal = false } = req.body;
      
    console.log('Attempting to sign deal:', {
      signature: signature?.signatureBase64?.slice(0, 10) + '...',
      dealId,
      propertyId,
      ownerId,
      renterId,
      userId,
      isCreateDeal,
      authenticatedUserId: req.user?._id,
      timestampLog: new Date().toISOString(),
    });

    if (!dealId || !propertyId || !ownerId || !renterId || !userId || !signature || (isCreateDeal && (!terms || !timestamp))) {
      console.warn('Missing required fields:', {
        dealId,
        propertyId,
        ownerId,
        renterId,
        userId,
        signatureProvided: !!signature,
        termsProvided: !!terms,
        timestampProvided: !!timestamp,
        isCreateDeal,
        authenticatedUserId: req.user?._id,
        timestampLog: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'Deal ID, property ID, owner ID, renter ID, user ID, signature, and (for deal creation) terms and timestamp are required' });
    }

    if (userId !== req.user?._id.toString()) {
      console.warn('User ID mismatch:', {
        providedUserId: userId,
        authenticatedUserId: req.user?._id,
        timestampLog: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Provided user ID does not match authenticated user' });
    }

    let deal;
    if (isCreateDeal) {
      deal = await Deal.findOne({ propertyId, ownerId, renterId });
      if (deal && deal.signatures.owner.signed && deal.signatures.renter.signed) {
        console.warn('Existing deal found:', {
          propertyId,
          dealId: deal._id,
          status: deal.status,
          userId,
          timestampLog: new Date().toISOString(),
        });
        return res.status(400).json({ message: 'An active deal already exists for this property, owner, and rentee' });
      }

      const property = await Property.findById(propertyId);
      if (!property) {
        console.warn('Property not found:', { propertyId, userId, timestampLog: new Date().toISOString() });
        return res.status(404).json({ message: 'Property not found' });
      }
      if (!['available', 'pending'].includes(property.status)) {
        console.warn('Property not available:', { propertyId, status: property.status, userId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: `Property is not available for deals (status: ${property.status})` });
      }

      deal = new Deal({
        propertyId,
        ownerId,
        renterId,
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        monthlyRent: req.body.monthlyRent || 1000,
        securityDeposit: req.body.securityDeposit || 1000,
        terms: terms || 'Standard lease agreement',
        status: 'pending',
        signatures: {
          owner: {
            signed: userId === ownerId ? true : false,
            signedAt: userId === ownerId ? new Date() : null,
            signature: userId === ownerId ? signature : null,
          },
          renter: {
            signed: userId === renterId ? true : false,
            signedAt: userId === renterId ? new Date() : null,
            signature: userId === renterId ? signature : null,
          },
        },
      });
      await deal.save();
      property.status = 'pending';
      await property.save();
    } else {
      deal = await Deal.findById(dealId);
      if (!deal) {
        console.warn('Deal not found:', { dealId, userId, timestampLog: new Date().toISOString() });
        return res.status(404).json({ message: 'Deal not found' });
      }
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      console.warn('Property not found:', { propertyId, userId, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Property not found' });
    }
    if (!['available', 'pending'].includes(property.status)) {
      console.warn('Property not available:', { propertyId, status: property.status, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: `Property is not available for deals (status: ${property.status})` });
    }

    if (deal.propertyId.toString() !== propertyId ||
        deal.ownerId.toString() !== ownerId ||
        deal.renterId.toString() !== renterId) {
      console.warn('Deal details mismatch:', {
        dealId,
        provided: { propertyId, ownerId, renterId },
        expected: { propertyId: deal.propertyId, ownerId: deal.ownerId, renterId: deal.renterId },
        userId,
        timestampLog: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'Deal details do not match provided information' });
    }

    const isOwner = req.user._id.toString() === ownerId.toString();
    if (!isOwner && deal.renterId.toString() !== req.user._id.toString()) {
      console.warn('Unauthorized to sign deal:', {
        dealId: deal._id,
        userId: req.user._id,
        ownerId: deal.ownerId,
        renterId: deal.renterId,
        timestampLog: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Not authorized to sign this deal' });
    }

    if (deal.status === 'completed' && deal.signatures.owner.signature && deal.signatures.renter.signature) {
      console.warn('Deal already completed:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Deal is already completed and cannot be modified' });
    }

    if (isOwner && deal.signatures.owner.signed) {
      console.warn('Owner already signed:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'You have already signed this deal' });
    }
    if (!isOwner && deal.signatures.renter.signed) {
      console.warn('Renter already signed:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'You have already signed this deal' });
    }

    const publicKeyRecord = await PublicKey.findOne({ userId: req.user._id });
    if (!publicKeyRecord) {
      console.warn('User public key not found:', { userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'User public key not found' });
    }

    console.log('Public key retrieved:', {
      userId,
      publicKeySnippet: publicKeyRecord.publicKey.slice(0, 50) + '...',
      timestampLog: new Date().toISOString(),
    });

    const dealData = {
      propertyId: deal.propertyId.toString(),
      ownerId: deal.ownerId.toString(),
      renterId: deal.renterId.toString(),
     
    };

    const isValidSignature = await CryptoService.verifySignature(publicKeyRecord.publicKey, dealData, signature, isCreateDeal);
    if (!isValidSignature) {
      console.warn('Invalid signature:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Invalid signature provided' });
    }

    if (isOwner && deal.signatures.renter.signature) {
      const renterPublicKeyRecord = await PublicKey.findOne({ userId: deal.renterId });
      if (!renterPublicKeyRecord) {
        console.warn('Renter public key not found:', { userId: deal.renterId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'Renter public key not found' });
      }
      const isValidRenterSignature = await CryptoService.verifySignature(
        renterPublicKeyRecord.publicKey,
        dealData,
        deal.signatures.renter.signature,
        isCreateDeal
      );
      if (!isValidRenterSignature) {
        console.warn('Invalid renter signature:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'Invalid existing renter signature' });
      }
    } else if (isOwner && deal.signatures.owner.signature) {
      const ownerPublicKeyRecord = await PublicKey.findOne({ userId: deal.ownerId });
      if (!ownerPublicKeyRecord) {
        console.warn('Owner public key not found:', { userId: deal.ownerId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'Owner public key not found' });
      }
      const isValidOwnerSignature = await CryptoService.verifySignature(
        ownerPublicKeyRecord.publicKey,
        dealData,
        deal.signatures.owner.signature,
        isCreateDeal
      );
      if (!isValidOwnerSignature) {
        console.log('Invalid owner signature:', { dealId: deal._id, userId, timestampLog: new Date().toISOString() });
        return res.status(400).json({ message: 'Invalid existing owner signature' });
      }
    }

    // Add signature if not already signed
    if (isOwner && !deal.signatures.owner.signed) {
      deal.signatures.owner.signed = true;
      deal.signatures.owner.signedAt = new Date();
      deal.signatures.owner.signature = signature;
    } else if (!isOwner && !deal.signatures.renter.signed) {
      deal.signatures.renter.signed = true;
      deal.signatures.renter.signedAt = new Date();
      deal.signatures.renter.signature = signature;
    }

    if (deal.signatures.owner.signed && deal.signatures.renter.signed) {
      deal.status = 'completed';
      property.status = 'rented';
      await property.save();
    } else {
      deal.status = 'pending';
      property.status = 'pending';
      await property.save();
    }

    await deal.save();

    console.log('Deal signed:', {
      dealId: deal._id,
      status: deal.status,
      signatures: {
        owner: {
          signed: deal.signatures.owner.signed,
          signedAt: deal.signatures.owner.signedAt,
          signature: deal.signatures.owner.signature?.signatureBase64?.slice(0, 10) + '...',
        },
        renter: {
          signed: deal.signatures.renter.signed,
          signedAt: deal.signatures.renter.signedAt,
          signature: deal.signatures.renter.signature?.signatureBase64?.slice(0, 10) + '...',
        },
      },
      propertyStatus: property.status,
      userId,
      timestampLog: new Date().toISOString(),
    });

    const populatedDeal = await Deal.findById(deal._id)
      .populate('propertyId')
      .populate('ownerId', 'name email')
      .populate('renterId', 'name email');

    res.json(populatedDeal);
  } catch (error) {
    console.error('Error signing deal:', {
      dealId: req.body.dealId,
      propertyId: req.body.propertyId,
      userId: req.body.userId,
      error: error.stack,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error signing deal', error: error.message });
  }
};

const getDealStatus = async (req, res) => {
  try {
    const { propertyId,renterId,ownerId } = req.query; 
    const userId = req.query.userId || req.user._id;

    console.log('Fetching deal status:', {
      ownerId,
      renterId,
      propertyId,
      userId,
      requesterId: req.user._id,
      timestampLog: new Date().toISOString(),
    });

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      console.warn('Invalid property ID:', { propertyId, userId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.warn('Invalid user ID:', { userId, propertyId, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      console.warn('Property not found:', { propertyId, userId, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Property not found' });
    }

    const isOwner = property.ownerId.toString() === userId.toString();
    if (!isOwner && userId !== req.user._id.toString()) {
      console.warn('Unauthorized access:', {
        propertyId,
        userId,
        requesterId: req.user._id,
        timestampLog: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Not authorized to view or create deals for this user' });
    }
           console.log(ownerId,renterId)
    let deal = await Deal.findOne({
      propertyId,
      $or: [{ ownerId: ownerId }, { renterId: renterId }],
    })
      

    if (!deal) {
      deal =  {
        propertyId,
        ownerId: property.ownerId,
        renterId: renterId,
        status: 'Deal',
        signatures: {
          owner: { signed: false, signedAt: null, signature: null },
          renter: { signed: false, signedAt: null, signature: null },
        },
        terms: 'Standard lease agreement',
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        monthlyRent: property.price || 1000,
        securityDeposit: property.price || 1000,
      };
      console.log(deal,'kkk')
      return res.json(deal);
    }
    else {
      console.log(deal,'ccc')
      return res.json(deal)
    }

    const conflictingDeal = await Deal.findOne({
      propertyId,
      renterId,
      ownerId,
      status: { $in: ['pending', 'completed'] },
    });
    if (conflictingDeal) {
      console.warn('Existing deal found:', {
        propertyId,
        dealId: conflictingDeal._id,
        status: conflictingDeal.status,
        userId,
        timestampLog: new Date().toISOString(),
      });
      return res.status(400).json({ message: 'An active deal already exists for this property' });
    }
  }
  catch (error) {
    console.error('Error fetching deal status:', {
      propertyId: req.params.propertyId,
      userId: req.query.userId || req.user?._id,
      error: error.stack,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error fetching deal status', error: error.message });
  }
}

const getUserDeals = async (req, res) => {
  try {
    const deals = await Deal.find({
      $or: [{ ownerId: req.user._id }, { renterId: req.user._id }],
    })
      .populate('propertyId')
      .populate('ownerId', 'name email')
      .populate('renterId', 'name email')
      .sort({ createdAt: -1 });

    console.log('Deals fetched for user:', {
      userId: req.user._id,
      dealCount: deals.length,
      dealIds: deals.map((d) => d._id.toString()),
      timestampLog: new Date().toISOString(),
    });

    res.json(deals);
  } catch (error) {
    console.log('Error fetching deals:', {
      userId: req.user._id,
      error: error,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
};

const getDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('propertyId')
      .populate('ownerId', 'name email')
      .populate('renterId', 'name email');

    if (!deal) {
      console.warn('Deal not found:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.ownerId._id.toString() !== req.user._id.toString() && deal.renterId._id.toString() !== req.user._id.toString()) {
      console.warn('Unauthorized to view deal:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(403).json({ message: 'Not authorized to view this deal' });
    }

    res.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', {
      dealId: req.params.id,
      userId: req.user._id,
      error: error.message,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error fetching deal', error: error.message });
  }
};

const updateDealStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      console.warn('Deal not found:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.ownerId.toString() !== req.user._id.toString() && deal.renterId.toString() !== req.user._id.toString()) {
      console.warn('Unauthorized to update deal:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(403).json({ message: 'Not authorized to update this deal' });
    }

    deal.status = status;
    await deal.save();

    if (status === 'completed' || status === 'cancelled') {
      const property = await Property.findById(deal.propertyId);
      property.status = status === 'completed' ? 'rented' : 'available';
      await property.save();
      console.log('Property status updated:', {
        propertyId: deal.propertyId,
        status: property.status,
        dealId: deal._id,
        userId: req.user._id,
        timestampLog: new Date().toISOString(),
      });
    }

    console.log('Deal status updated:', {
      dealId: deal._id,
      status: deal.status,
      userId: req.user._id,
      timestampLog: new Date().toISOString(),
    });

    res.json(deal);
  } catch (error) {
    console.error('Error updating deal:', {
      dealId: req.params.id,
      userId: req.user._id,
      error: error.message,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error updating deal', error: error.message });
  }
};

const addPayment = async (req, res) => {
  try {
    const { amount, dueDate, paymentMethod, transactionId } = req.body;

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      console.warn('Deal not found:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.renterId.toString() !== req.user._id.toString()) {
      console.warn('Unauthorized to add payment:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(403).json({ message: 'Not authorized to add payment' });
    }

    deal.payments.push({
      amount,
      dueDate,
      paymentMethod,
      transactionId,
      status: 'paid',
      paidAt: new Date(),
    });

    await deal.save();

    console.log('Payment added:', {
      dealId: deal._id,
      paymentId: deal.payments[deal.payments.length - 1]._id,
      userId: req.user._id,
      timestampLog: new Date().toISOString(),
    });

    res.json(deal);
  } catch (error) {
    console.error('Error adding payment:', {
      dealId: req.params.id,
      userId: req.user._id,
      error: error.message,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error adding payment', error: error.message });
  }
};

const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      console.warn('Deal not found:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (deal.ownerId.toString() !== req.user._id.toString() && deal.renterId.toString() !== req.user._id.toString()) {
      console.warn('Unauthorized to add review:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(403).json({ message: 'Not authorized to add review' });
    }

    if (deal.status !== 'completed') {
      console.warn('Deal not completed for review:', { dealId: req.params.id, status: deal.status, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'Can only review completed deals' });
    }

    const existingReview = deal.reviews.find(
      (review) => review.userId.toString() === req.user._id.toString()
    );
    if (existingReview) {
      console.warn('User already reviewed:', { dealId: req.params.id, userId: req.user._id, timestampLog: new Date().toISOString() });
      return res.status(400).json({ message: 'You have already reviewed this deal' });
    }

    deal.reviews.push({
      userId: req.user._id,
      rating,
      comment,
    });

    await deal.save();

    console.log('Review added:', {
      dealId: deal._id,
      reviewId: deal.reviews[deal.reviews.length - 1]._id,
      userId: req.user._id,
      timestampLog: new Date().toISOString(),
    });

    res.json(deal);
  } catch (error) {
    console.error('Error adding review:', {
      dealId: req.params.id,
      userId: req.user._id,
      error: error.message,
      timestampLog: new Date().toISOString(),
    });
    res.status(500).json({ message: 'Error adding review', error: error.message });
  }
};

module.exports = {
  createDeal,
  getDealStatus,
  signDeal,
  getUserDeals,
  getDeal,
  updateDealStatus,
  addPayment,
  addReview,
};