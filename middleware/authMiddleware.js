const jwt = require('jsonwebtoken');
const Parent = require('../models/Parent');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.parent = await Parent.findById(decoded.id).select('-password -parentalPIN');
        next();
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Not authorized, token failed'
        });
      }
    }

    if (!token) {
      res.status(401).json({
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

module.exports = { protect };