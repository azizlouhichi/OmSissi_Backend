const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
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
    enum: ['active', 'cancelled', 'past_due', 'unpaid'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
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
  cancelledAt: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  }
}, {
  timestamps: true
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