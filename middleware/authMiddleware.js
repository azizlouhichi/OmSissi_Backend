const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');
const Child = require('../models/Child');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ? Support both parent and child tokens
        if (decoded.role === 'child') {
          req.child = await Child.findById(decoded.childId);
          req.parent = await Parent.findById(decoded.parentId).select('-password -parentalPIN');
          req.userType = 'child';
        } else {
          req.parent = await Parent.findById(decoded.id).select('-password -parentalPIN');
          req.userType = 'parent';
        }
        
        if (!req.parent && !req.child) {
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
// Add this new middleware to protect child-specific routes
const protectChild = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify it's a child session token
      if (decoded.type !== 'child_session') {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - child session required'
        });
      }

      req.parentId = decoded.parentId;
      req.childId = decoded.childId;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - invalid token'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - no token'
    });
  }
};

module.exports = { protect, protectParent, protectChild };