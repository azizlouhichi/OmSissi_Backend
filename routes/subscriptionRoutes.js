
const express = require('express');
const router = express.Router();
const {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getMySubscription,
  cancelSubscription,
  resumeSubscription,
  getAllSubscriptions,
  getSubscriptionStats,
  getSubscriptionById,
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/plans', getAvailablePlans);

// Webhook route (PAS de middleware protect!)
router.post('/webhook', handleWebhook);

// Protected routes - User
router.get('/my-subscription', protect, getMySubscription);
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/cancel-subscription', protect, cancelSubscription);
router.post('/resume-subscription', protect, resumeSubscription);

// Protected routes - Admin/Analytics
router.get('/all', protect, getAllSubscriptions);
router.get('/stats', protect, getSubscriptionStats);
router.get('/:id', protect, getSubscriptionById);

module.exports = router;