const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_key_123';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'yenatcreation@gmail.com',
    pass: 'kvweabgevsrnewqv',
  },
});

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otp, 10);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Temporarily store OTP in User model
    await User.updateOne(
      { email },
      { $set: { registrationOTP: hashedOTP, registrationOTPExpires: otpExpires } },
      { upsert: true }
    );

    const mailOptions = {
      from: '"MuluCareer" <yenatcreation@gmail.com>',
      to: email,
      subject: 'Registration OTP',
      text: `Your OTP for registration is: ${otp}\nThis OTP is valid for 10 minutes.`,
      html: `
        <h2>Registration Verification</h2>
        <p>Your OTP for registration is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

const register = async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    console.log('Registration request files:', req.files);

    const { name, email, password, phone, role, otp } = req.body;
    let profile = {};

    try {
      if (req.body.profile) {
        profile = JSON.parse(req.body.profile);
      }
    } catch (e) {
      console.error('Error parsing profile:', e);
    }

    if (req.files) {
      if (req.files.profilePicture) {
        profile.avatar = req.files.profilePicture[0].path;
      }
      if (req.files.frontId) {
        profile.frontId = req.files.frontId[0].path;
      }
      if (req.files.backId) {
        profile.backId = req.files.backId[0].path;
      }
    }

    if (!name || !email || !password || !phone || !otp) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: { name, email, password, phone, otp }
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.registrationOTP) {
      return res.status(400).json({ message: 'OTP verification required' });
    }

    const isMatch = await bcrypt.compare(otp, user.registrationOTP);
    if (!isMatch || user.registrationOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP fields
    user.registrationOTP = undefined;
    user.registrationOTPExpires = undefined;
    user.name = name;
    user.password = password;
    user.phone = phone;
    user.role = role || 'user';
    user.profile = profile;

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
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
        name: user.name,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.body.id).select('-password');
    console.log(req);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otp, 10);
    user.resetPasswordOTP = hashedOTP;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const mailOptions = {
      from: '"MuluCareer" <yenatcreation@gmail.com>',
      to: user.email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}\nThis OTP is valid for 10 minutes.`,
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error sending OTP', error: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({
      email,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user || !user.resetPasswordOTP) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetPasswordOTP);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const resetToken = jwt.sign(
      { userId: user._id, purpose: 'reset-password' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
      if (decoded.purpose !== 'reset-password') {
        return res.status(400).json({ message: 'Invalid reset token' });
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
  sendOtp,
  transporter
};