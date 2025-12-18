// Load environment variables if not already loaded
if (!process.env.STRIPE_SECRET_KEY) {
  require('dotenv').config();
}

// Debug logging
console.log('STRIPE_SECRET_KEY environment variable:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET');
console.log('STRIPE_SECRET_KEY starts with sk_test_ or sk_live_:', process.env.STRIPE_SECRET_KEY && (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')));

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Define plan configurations
const PLANS = {
  free: {
    name: 'free',
    displayName: 'Free Plan',
    price: 0,
    interval: 'month',
    maxChildren: 2,
    maxStoriesPerDay: 5,
    maxStoriesPerMonth: 150,
    aiGenerationPriority: 'medium',
    features: [
      'Create up to 2 child profiles',
      'Generate up to 5 stories per day',
      'Access to basic story generation',
      'Standard AI response time'
    ]
  },
  basic: {
    name: 'basic',
    displayName: 'Basic Plan',
    price: 499, // $4.99 in cents
    interval: 'month',
    maxChildren: 4,
    maxStoriesPerDay: 10,
    maxStoriesPerMonth: 300,
    aiGenerationPriority: 'high',
    features: [
      'Create up to 4 child profiles',
      'Generate up to 10 stories per day',
      'Access to advanced story themes',
      'Faster AI response time',
      'Priority customer support'
    ]
  },
  unlimited: {
    name: 'unlimited',
    displayName: 'Unlimited Plan',
    price: 999, // $9.99 in cents
    interval: 'month',
    maxChildren: 10,
    maxStoriesPerDay: 50,
    maxStoriesPerMonth: 1500,
    aiGenerationPriority: 'high',
    features: [
      'Create up to 10 child profiles',
      'Generate up to 50 stories per day',
      'Unlimited story generation',
      'Premium AI response time',
      'Early access to new features',
      '24/7 premium customer support'
    ]
  }
};

// Function to initialize default plans in the database
const initializePlans = async () => {
  const SubscriptionPlan = require('../models/Subscription').SubscriptionPlan;

  try {
    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.countDocuments();

    if (existingPlans === 0) {
      // Insert default plans
      for (const planKey in PLANS) {
        const plan = PLANS[planKey];
        await SubscriptionPlan.create({
          name: plan.name,
          displayName: plan.displayName,
          price: plan.price,
          currency: 'usd',
          interval: plan.interval,
          features: plan.features,
          maxChildren: plan.maxChildren,
          maxStoriesPerDay: plan.maxStoriesPerDay,
          maxStoriesPerMonth: plan.maxStoriesPerMonth,
          aiGenerationPriority: plan.aiGenerationPriority,
          isActive: true
        });
      }
      console.log('Default subscription plans initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  }
};

module.exports = {
  stripe,
  PLANS,
  initializePlans
};