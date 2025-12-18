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
      acceptedTerms: acceptedTerms === 'true',
      plan: 'free' // New users start with free plan
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
          plan: parent.plan,
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
          plan: parent.plan,
          token: generateToken(parent._id)
        }
      });
      console.log(`Parent logged in: ${parent.email}`);
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
    const parent = await Parent.findById(req.parent._id)
      .select('-password -parentalPIN')
      .populate('subscriptionId', 'planName status startDate endDate cancelAtPeriodEnd');

    if (parent) {
      res.json({
        success: true,
        data: {
          ...parent.toObject(),
          currentPlan: parent.plan
        }
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
// @desc    Switch to child profile (generate child-scoped token)
// @route   POST /api/parents/switch-child/:childId
// @access  Private (parent must be authenticated)
const switchToChild = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.parent._id;

    // Verify child belongs to this parent
    const Child = require('../models/Child');
    const child = await Child.findOne({ _id: childId, parentId: parentId });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found or does not belong to this parent'
      });
    }

    // Generate a child-scoped token (includes both parent and child ID)
    const childToken = jwt.sign(
      {
        parentId: parentId,
        childId: child._id,
        type: 'child_session'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Switched to child profile successfully',
      data: {
        childId: child._id,
        childName: child.firstName,
        childEmoji: child.emoji || '🐻',
        childToken: childToken
      }
    });
  } catch (error) {
    console.error('Switch child error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during child switch',
      error: error.message
    });
  }
};

// @desc    Switch back to parent profile from child session
// @route   POST /api/parents/switch-back
// @access  Private (parent must be in child session)
const switchBackToParent = async (req, res) => {
  try {
    // Check if user is currently in a child session
    if (req.userType !== 'child_session') {
      return res.status(400).json({
        success: false,
        message: 'You are not currently in a child session'
      });
    }

    // Generate a new parent token
    const parentToken = jwt.sign(
      { id: req.parent._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Switched back to parent profile successfully',
      data: {
        parentId: req.parent._id,
        parentName: req.parent.firstName + ' ' + req.parent.lastName,
        parentToken: parentToken
      }
    });
  } catch (error) {
    console.error('Switch back error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during switch back',
      error: error.message
    });
  }
};

// @desc    Get currently viewed child profile (when in child session)
// @route   GET /api/parents/current-child
// @access  Private (parent must be in child session)
const getCurrentChildProfile = async (req, res) => {
  try {
    // Check if user is currently in a child session
    if (req.userType !== 'child_session') {
      return res.status(400).json({
        success: false,
        message: 'You are not currently in a child session'
      });
    }

    res.json({
      success: true,
      message: 'Current child profile retrieved successfully',
      data: {
        childId: req.child._id,
        childName: req.child.firstName,
        childAge: req.child.age,
        childGender: req.child.gender,
        childPreferredLanguages: req.child.preferredLanguages,
        childInterests: req.child.interests,
        childReadingLevel: req.child.readingLevel,
        childPreferredVoice: req.child.preferredVoice,
        childSafeMode: req.child.safeMode
      }
    });
  } catch (error) {
    console.error('Get current child profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving child profile',
      error: error.message
    });
  }
};

module.exports = {
  registerParent,
  loginParent,
  getParentProfile,
  switchToChild,
  switchBackToParent,
  getCurrentChildProfile
};