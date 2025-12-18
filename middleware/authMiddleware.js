const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');
const Child = require('../models/Child');
const Admin = require('../models/Admin')

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const header = req.headers.authorization;
      // Debug: log presence and a short preview of token
      try { console.debug('authMiddleware - Authorization header present:', header.slice(0,20) + '...'); } catch(e){}
      token = header.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        // Admin token (supports tokens with { role: 'admin', adminId } or legacy { id })
        if (decoded.role === 'admin' || decoded.adminId) {
          const adminId = decoded.adminId || decoded.id;
          req.admin = await Admin.findById(adminId).select('-password -parentalPIN');
          // Fallback: try lookup by email if id lookup failed and email present in token
          if (!req.admin && decoded.adminEmail) {
            req.admin = await Admin.findOne({ email: decoded.adminEmail }).select('-password -parentalPIN');
            if (req.admin) {
              console.warn('Admin found by email fallback for', decoded.adminEmail);
            }
          }
          req.userType = 'admin';
          if (!req.admin) {
            console.warn('Admin token present but no admin found for id/email:', adminId, decoded.adminEmail);
          }

        // Child token
        } else if (decoded.role === 'child') {
          req.child = await Child.findById(decoded.childId);
          req.parent = await Parent.findById(decoded.parentId).select('-password -parentalPIN');
          req.userType = 'child';

        // Default: parent token (expects payload { id })
        } else {
          req.parent = await Parent.findById(decoded.id).select('-password -parentalPIN');
          req.userType = 'parent';
        }
        
        if (!req.parent && !req.child && !req.admin) {
          return res.status(401).json({
            success: false,
            message: 'User not found'
          });
        }
        
        next();
      } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
          success: false,
          message: 'Not authorized, token failed'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// ? Parent-only middleware
const protectParent = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.userType !== 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Parents only.'
      });
    }
    next();
  });
};

// ? Admin-only middleware
const protectAdmin = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admins only.'
      });
    }
    next();
  });
};

module.exports = { protect, protectParent, protectAdmin };