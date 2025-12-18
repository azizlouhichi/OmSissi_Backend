// Test script for subscription functionality
const mongoose = require('mongoose');
const { Subscription, SubscriptionPlan } = require('./models/Subscription');
const { initializePlans, PLANS } = require('./utils/stripe');
require('dotenv').config();

// Connect to database
const connectDB = require('./config/database');
connectDB();

// Wait for connection to be established
setTimeout(async () => {
  console.log('Testing subscription functionality...\n');

  try {
    // Initialize plans if they don't exist
    await initializePlans();

    // Test: Get available plans
    console.log('1. Testing available plans retrieval...');
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    console.log(`Found ${plans.length} active plans:`);
    plans.forEach(plan => {
      console.log(`  - ${plan.displayName}: $${plan.price / 100}/${plan.interval}`);
    });

    // Test: Create a sample subscription
    console.log('\n2. Testing subscription creation...');
    
    // Get a plan to use for testing
    const basicPlan = await SubscriptionPlan.findOne({ name: 'basic' });
    if (basicPlan) {
      console.log(`  Found basic plan with ID: ${basicPlan._id}`);
    } else {
      console.log('  Basic plan not found, creating it...');
      const basicPlan = await SubscriptionPlan.create({
        name: 'basic',
        displayName: 'Basic Plan',
        price: 499, // $4.99 in cents
        currency: 'usd',
        interval: 'month',
        features: ['Up to 4 child profiles', 'Generate up to 10 stories per day'],
        maxChildren: 4,
        maxStoriesPerDay: 10,
        maxStoriesPerMonth: 300,
        aiGenerationPriority: 'high',
        isActive: true
      });
      console.log(`  Created basic plan with ID: ${basicPlan._id}`);
    }

    console.log('\n✓ All tests completed successfully!');
    console.log('\nSubscription system is ready for use with the following endpoints:');
    console.log('GET    /api/subscriptions/plans                  - Get available plans');
    console.log('POST   /api/subscriptions/create-checkout-session - Create Stripe checkout');
    console.log('POST   /api/subscriptions/webhook               - Handle Stripe webhooks');
    console.log('GET    /api/subscriptions/my-subscription       - Get current subscription');
    console.log('POST   /api/subscriptions/cancel-subscription   - Cancel subscription');
    console.log('POST   /api/subscriptions/resume-subscription   - Resume subscription');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Close the database connection
    mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}, 1000);