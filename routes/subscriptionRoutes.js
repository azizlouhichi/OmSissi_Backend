const express = require('express');
const router = express.Router();
const {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getMySubscription,
  getSubscriptions,
  getSubscriptionStats,
  cancelSubscription,
  resumeSubscription
} = require('../controllers/subscriptionController');
const { protect, protectAdmin } = require('../middleware/authMiddleware');

// Admin update subscription
const { updateSubscriptionById } = require('../controllers/subscriptionController');

// Public routes
router.get('/plans', getAvailablePlans);

// Webhook route (public - called by Stripe)
router.post('/webhook', express.raw({type: 'application/json'}), handleWebhook);

// Protected routes
router.get('/', protect, getSubscriptions); // Admin listing of subscriptions
router.get('/stats', protect, getSubscriptionStats);
router.put('/:id', protectAdmin, updateSubscriptionById);
router.get('/my-subscription', protect, getMySubscription);
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/cancel-subscription', protect, cancelSubscription);
router.post('/resume-subscription', protect, resumeSubscription);

module.exports = router;