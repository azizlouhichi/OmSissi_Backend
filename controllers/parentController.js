const Parent = require('../models/Parent');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new parent
// @route   POST /api/parents/register
// @access  Public
const registerParent = async (req, res) => {
  try {
    const { firstName, lastName, email, password, parentalPIN, acceptedTerms } = req.body;

    // Check if parent already exists
    const parentExists = await Parent.findOne({ email });
    if (parentExists) {
      return res.status(400).json({
        success: false,
        message: 'Parent already exists with this email'
      });
    }

    // Create new parent
    const parent = await Parent.create({
      firstName,
      lastName,
      email,
      password,
      parentalPIN,
      acceptedTerms: acceptedTerms === 'true'
    });

    if (parent) {
      res.status(201).json({
        success: true,
        message: 'Parent account created successfully',
        data: {
          _id: parent._id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          token: generateToken(parent._id)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid parent data'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login parent
// @route   POST /api/parents/login
// @access  Public
const loginParent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for parent
    const parent = await Parent.findOne({ email });
    if (parent && (await parent.checkPassword(password))) {
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: parent._id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email,
          token: generateToken(parent._id)
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get parent profile
// @route   GET /api/parents/profile
// @access  Private
const getParentProfile = async (req, res) => {
  try {
    const parent = await Parent.findById(req.parent._id).select('-password -parentalPIN');
    
    if (parent) {
      res.json({
        success: true,
        data: parent
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  registerParent,
  loginParent,
  getParentProfile
};