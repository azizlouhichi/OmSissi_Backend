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
    displayName: 'Plan Gratuit',
    price: 0,
    interval: 'month',
    maxChildren: 2,
    maxStoriesPerDay: 5,
    maxStoriesPerMonth: 150,
    aiGenerationPriority: 'medium',
    features: [
      'Créer jusqu\'à 2 profils d\'enfants',
      'Générer jusqu\'à 5 histoires par jour',
      'Accès à la génération d\'histoires basique',
      'Temps de réponse IA standard'
    ]
  },
  basic: {
    name: 'basic',
    displayName: 'Plan Basique',
    price: 499, // $4.99 in cents
    interval: 'month',
    maxChildren: 4,
    maxStoriesPerDay: 10,
    maxStoriesPerMonth: 300,
    aiGenerationPriority: 'high',
    features: [
      'Créer jusqu\'à 4 profils d\'enfants',
      'Générer jusqu\'à 10 histoires par jour',
      'Accès aux thèmes d\'histoires avancés',
      'Temps de réponse IA plus rapide',
      'Support client prioritaire'
    ]
  },
  unlimited: {
    name: 'unlimited',
    displayName: 'Plan Illimité',
    price: 999, // $9.99 in cents
    interval: 'month',
    maxChildren: 10,
    maxStoriesPerDay: 50,
    maxStoriesPerMonth: 1500,
    aiGenerationPriority: 'high',
    features: [
      'Créer jusqu\'à 10 profils d\'enfants',
      'Générer jusqu\'à 50 histoires par jour',
      'Génération d\'histoires illimitée',
      'Temps de réponse IA premium',
      'Accès anticipé aux nouvelles fonctionnalités',
      'Support client premium 24/7'
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