const jwt = require('jsonwebtoken');
const User = require('../models/User');


const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_key_123';


const register = async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    console.log('Registration request files:', req.files);
    
    const { name, email, password, phone, role } = req.body;
    let profile = {};
    
    try {
      if (req.body.profile) {
        profile = JSON.parse(req.body.profile);
      }
    } catch (e) {
      console.error('Error parsing profile:', e);
    }

    
    if (req.files) {
      if (req.files.frontId) {
        profile.frontId = req.files.frontId[0].path;
      }
      if (req.files.backId) {
        profile.backId = req.files.backId[0].path;
      }
    }

    
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: { name, email, password, phone }
      });
    }

    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    
    const user = new User({
      name,
      email,
      password,
      phone,
      role: role || 'user',
      profile
    });

    await user.save();

    
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' + error.message , error: error.message });
  }
};


const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser
}; 