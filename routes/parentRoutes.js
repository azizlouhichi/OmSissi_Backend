const express = require('express');
const router = express.Router();
const {
  registerParent,
  loginParent,
  getParentProfile
} = require('../controllers/parentController');
const { validateParentRegistration } = require('../middleware/validation');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', validateParentRegistration, registerParent);
router.post('/login', loginParent);

// Protected routes
router.get('/profile', protect, getParentProfile);

module.exports = router;