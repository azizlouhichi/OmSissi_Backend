const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  verifyAdmin,
  getAdminProfile
} = require('../controllers/adminController');

// Public routes
router.post('/login', loginAdmin);

// Protected routes
router.get('/verify', verifyAdmin);
router.get('/profile', getAdminProfile);

// Admin child management
router.use('/children', require('./adminChildRoutes'));

module.exports = router;