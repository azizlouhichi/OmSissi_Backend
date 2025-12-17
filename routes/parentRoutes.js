const express = require('express');
const router = express.Router();
const {
  registerParent,
  loginParent,
  getParentProfile,
  switchToChild,
  switchBackToParent,
  getCurrentChildProfile
} = require('../controllers/parentController');
const { validateParentRegistration } = require('../middleware/validation');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', registerParent);
router.post('/login', loginParent);

// Protected routes
router.get('/profile', protect, getParentProfile);
router.post('/switch-child/:childId', protect, switchToChild);
router.post('/switch-back', protect, switchBackToParent);
router.get('/current-child', protect, getCurrentChildProfile);

module.exports = router;