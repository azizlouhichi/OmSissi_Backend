const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const parentSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  parentalPIN: {
    type: String,
    required: [true, 'Parental PIN is required'],
    validate: {
      validator: function(v) {
        // Allow either a plain 4-digit PIN (during creation) or a bcrypt hash (when stored)
        if (!v) return false;
        const isPlain = /^\d{4}$/.test(v);
        const isHash = typeof v === 'string' && v.startsWith('$2');
        return isPlain || isHash;
      },
      message: 'PIN must be exactly 4 digits'
    }
  },
  acceptedTerms: {
    type: Boolean,
    required: [true, 'You must accept the terms and conditions'],
    validate: {
      validator: function(value) {
        return value === true;
      },
      message: 'You must accept the terms and conditions'
    }
  },
  // Subscription-related fields
  plan: {
    type: String,
    enum: ['free', 'basic', 'unlimited'],
    default: 'free'
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  stripeCustomerId: {
    type: String
  },
  childrenProfiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
parentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash parental PIN before saving
parentSchema.pre('save', async function(next) {
  if (!this.isModified('parentalPIN')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.parentalPIN = await bcrypt.hash(this.parentalPIN, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
parentSchema.methods.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Method to check PIN
parentSchema.methods.checkPIN = async function(pin) {
  return await bcrypt.compare(pin, this.parentalPIN);
};

module.exports = mongoose.model('Parent', parentSchema);