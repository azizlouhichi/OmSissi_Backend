const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    enum: ['free', 'basic', 'unlimited'],
    unique: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'usd'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  features: [{
    type: String
  }],
  maxChildren: {
    type: Number,
    required: [true, 'Max children count is required'],
    min: [0, 'Max children cannot be negative']
  },
  maxStoriesPerDay: {
    type: Number,
    default: 5
  },
  maxStoriesPerMonth: {
    type: Number,
    default: 150
  },
  aiGenerationPriority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const subscriptionSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  planName: {
    type: String,
    enum: ['free', 'basic', 'unlimited'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'trialing', 'incomplete'],
    default: 'active'
  },
  // ✅ Garder Date mais sans default Date.now
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false
  },
  stripeCustomerId: {
    type: String,
    required: false
  },
  stripeSubscriptionId: {
    type: String,
    required: false
  },
  stripePaymentMethodId: {
    type: String,
    required: false
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  // ✅ Pas de default pour éviter les conflits
  cancelledAt: {
    type: Date,
    required: false
  },
  trialStart: {
    type: Date,
    required: false
  },
  trialEnd: {
    type: Date,
    required: false
  }
}, {
  timestamps: true  // Ceci ajoute automatiquement createdAt et updatedAt
});

// Indexes for common queries
subscriptionSchema.index({ parentId: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  if (this.status !== 'active') return false;
  
  if (this.endDate && this.endDate < new Date()) {
    return false;
  }
  
  return true;
};

// Method to check if subscription is in trial period
subscriptionSchema.methods.isInTrial = function() {
  if (this.trialStart && this.trialEnd) {
    const now = new Date();
    return now >= this.trialStart && now <= this.trialEnd;
  }
  return false;
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = {
  Subscription,
  SubscriptionPlan
};