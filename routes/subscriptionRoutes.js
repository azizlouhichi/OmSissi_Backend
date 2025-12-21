const express = require('express');
const router = express.Router();
const {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getMySubscription,
  cancelSubscription,
  resumeSubscription
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/plans', getAvailablePlans);

// ✅ Webhook route (PAS de middleware protect!)
router.post('/webhook', handleWebhook);

// Protected routes
router.get('/my-subscription', protect, getMySubscription);
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/cancel-subscription', protect, cancelSubscription);
router.post('/resume-subscription', protect, resumeSubscription);

module.exports = router;