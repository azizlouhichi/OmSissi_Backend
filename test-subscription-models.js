// Test script for subscription models functionality
const mongoose = require('mongoose');
const { Subscription, SubscriptionPlan } = require('./models/Subscription');
require('dotenv').config();

// Connect to database
const connectDB = require('./config/database');
connectDB();

// Wait for connection to be established
setTimeout(async () => {
  console.log('Testing subscription models functionality...\n');

  try {
    // Test: Create subscription plans
    console.log('1. Testing plan creation...');
    
    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.countDocuments();
    
    if (existingPlans === 0) {
      // Create the default plans
      const freePlan = await SubscriptionPlan.create({
        name: 'free',
        displayName: 'Free Plan',
        price: 0,
        currency: 'usd',
        interval: 'month',
        features: [
          'Create up to 2 child profiles',
          'Generate up to 5 stories per day',
          'Access to basic story generation',
          'Standard AI response time'
        ],
        maxChildren: 2,
        maxStoriesPerDay: 5,
        maxStoriesPerMonth: 150,
        aiGenerationPriority: 'medium',
        isActive: true
      });

      const basicPlan = await SubscriptionPlan.create({
        name: 'basic',
        displayName: 'Basic Plan',
        price: 499, // $4.99 in cents
        currency: 'usd',
        interval: 'month',
        features: [
          'Create up to 4 child profiles',
          'Generate up to 10 stories per day',
          'Access to advanced story themes',
          'Faster AI response time',
          'Priority customer support'
        ],
        maxChildren: 4,
        maxStoriesPerDay: 10,
        maxStoriesPerMonth: 300,
        aiGenerationPriority: 'high',
        isActive: true
      });

      const unlimitedPlan = await SubscriptionPlan.create({
        name: 'unlimited',
        displayName: 'Unlimited Plan',
        price: 999, // $9.99 in cents
        currency: 'usd',
        interval: 'month',
        features: [
          'Create up to 10 child profiles',
          'Generate up to 50 stories per day',
          'Unlimited story generation',
          'Premium AI response time',
          'Early access to new features',
          '24/7 premium customer support'
        ],
        maxChildren: 10,
        maxStoriesPerDay: 50,
        maxStoriesPerMonth: 1500,
        aiGenerationPriority: 'high',
        isActive: true
      });

      console.log(`  Created ${freePlan.displayName}, ${basicPlan.displayName}, and ${unlimitedPlan.displayName}`);
    } else {
      console.log(`  Found ${existingPlans} existing plans in database`);
    }

    // Test: Get available plans
    console.log('\n2. Testing available plans retrieval...');
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    console.log(`Found ${plans.length} active plans:`);
    plans.forEach(plan => {
      console.log(`  - ${plan.displayName}: $${plan.price / 100}/${plan.interval}`);
      console.log(`    Features: ${plan.features.join(', ')}`);
    });

    console.log('\n✓ Subscription models are working correctly!');

    console.log('\nAPI endpoints available for subscription management:');
    console.log('GET    /api/subscriptions/plans                  - Get available plans');
    console.log('POST   /api/subscriptions/create-checkout-session - Create Stripe checkout');
    console.log('POST   /api/subscriptions/webhook               - Handle Stripe webhooks (requires proper setup)');
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