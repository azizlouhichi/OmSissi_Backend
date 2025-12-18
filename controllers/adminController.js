const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

// Generate JWT Token (admin)
// Accept either an admin id or an admin object; include email for fallback lookups
const generateToken = (admin) => {
  let payload = { role: 'admin' };
  if (typeof admin === 'string' || admin instanceof String) {
    payload.adminId = admin;
  } else if (admin && typeof admin === 'object') {
    payload.adminId = admin._id || admin.id;
    if (admin.email) payload.adminEmail = admin.email;
    if (admin.role) payload.role = admin.role;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const   loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for admin
    const admin = await Admin.findOne({ email, isActive: true });
    
    if (admin && (await admin.checkPassword(password))) {
      // Update last login
      admin.lastLogin = new Date();
      await admin.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: generateToken(admin._id),
          admin: {
            _id: admin._id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            role: admin.role,
            lastLogin: admin.lastLogin
          }
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Verify admin token
// @route   GET /api/admin/verify
// @access  Private
const verifyAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    
    if (admin) {
      res.json({
        success: true,
        data: admin
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
  } catch (error) {
    console.error('Verify admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    
    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  loginAdmin,
  verifyAdmin,
  getAdminProfile
};