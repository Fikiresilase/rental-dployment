const axios = require("axios").default;
const CHAPA_URL = process.env.CHAPA_URL || "https://api.chapa.co/v1/transaction/initialize";
const CHAPA_AUTH = process.env.CHAPA_AUTH||'CHASECK_TEST-v3RsZV9S9vwdUN0B9buGUTe3urxyHKRK';
const User= require('../models/User');
const initiatePayment = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const tx_ref = `property-${user.id}-${Date.now()}`;
    const amount = 10;
    const callback_url = `http://localhost:5000/api/payment/verify-payment/${tx_ref}`;
    const return_url = `http://localhost:3000/payment-success?tx_ref=${tx_ref}`;
    const data = {
      amount: amount.toString(),
      currency: 'ETB',
      email: user.email,
      name: user.firsName || 'User',
      tx_ref,
      callback_url,
      return_url,
    };
    const config = {
      headers: {
        Authorization: `Bearer ${CHAPA_AUTH}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await axios.post(CHAPA_URL, data, config);
    if (response.data.status === 'success' && response.data.data.checkout_url) {
      
      return res.json({ checkout_url: response.data.data.checkout_url });
    } else {
      return res.status(400).json({ message: 'Failed to initialize payment' });
    }
  } catch (error) {
    
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const paymentChecker = async (req, res) => {
  const tx_ref = req.params.id;
  const user = req.user;
  if (!tx_ref) {
    return res.status(400).json({ message: 'Transaction reference (tx_ref) is required' });
  }
  if (!user || !user._id) {
    return res.status(401).json({ message: 'Unauthorized: user not found' });
  }
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${CHAPA_AUTH}`
      }
    };

   
    const response = await axios.get(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, config);
    const result = response.data;
    const userId= user.id
    if (result.status === 'success' && result.data.status === 'success') {
      console.log(result.status)
      
      const updatedUser = await User.findById(
        userId
      );
      updatedUser.role = 'owner'
      await updatedUser.save()
      console.log(updatedUser)

      return res.status(200).json({
        message: 'Payment verified successfully',
        data: result.data
      });
    } else {
      
      return res.status(400).json({
        message: 'Payment verification failed or not completed',
        data: result.data
      });
    }

  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    return res.status(500).json({
      message: 'Error verifying payment',
      error: error.response?.data || error.message
    });
  }
};

module.exports = { initiatePayment, paymentChecker };