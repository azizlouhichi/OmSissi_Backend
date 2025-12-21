const Parent = require('../models/Parent');
const { Subscription, SubscriptionPlan } = require('../models/Subscription');
const { stripe } = require('../utils/stripe');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Get available subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
const getAvailablePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    
    res.json({
      success: true,
      message: 'Available subscription plans retrieved successfully',
      data: plans
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving plans',
      error: error.message
    });
  }
};

// @desc    Create a checkout session for plan upgrade
// @route   POST /api/subscriptions/create-checkout-session
// @access  Private
const createCheckoutSession = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Please contact the administrator.'
      });
    }

    const { planId, planName } = req.body;
    const parentId = req.parent._id;

    // Find the selected plan
    const plan = await SubscriptionPlan.findOne({
      _id: planId,
      name: planName,
      isActive: true
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Selected plan not found or not available'
      });
    }

    // Get or create customer in Stripe
    let parent = await Parent.findById(parentId);
    let stripeCustomerId = parent.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create a new customer in Stripe
      const customer = await stripe.customers.create({
        email: parent.email,
        name: `${parent.firstName} ${parent.lastName}`,
        metadata: {
          parentId: parent._id.toString()
        }
      });
      stripeCustomerId = customer.id;

      // Save the customer ID to the parent record
      parent = await Parent.findByIdAndUpdate(
        parentId,
        { stripeCustomerId },
        { new: true }
      );
    }

    // CORRECTION: Utiliser le deep link de votre app au lieu de FRONTEND_URL
    const successUrl = `omsisi://subscription-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `omsisi://subscription-cancel`;

    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: {
            name: plan.displayName,
            description: plan.features.join(', ')
          },
          unit_amount: plan.price,
          recurring: {
            interval: plan.interval
          }
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        parentId: parentId.toString(),
        planId: planId.toString(),
        planName: planName
      }
    });

    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating checkout session',
      error: error.message
    });
  }
};

// @desc    Handle Stripe webhook for subscription updates
// @route   POST /api/subscriptions/webhook
// @access  Public (handled by Stripe)
const handleWebhook = async (req, res) => {
  // Check if Stripe is configured
  if (!stripe) {
    console.error('Stripe not configured, cannot process webhook');
    return res.status(500).json({ received: false, error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;

      try {
        const parentId = session.metadata?.parentId;
        const planId = session.metadata?.planId;
        const planName = session.metadata?.planName;

        if (parentId && planId && planName) {
          // Create or update subscription in our database
          const subscription = await stripe.subscriptions.retrieve(session.subscription);

          // Create or update subscription record
          const newSubscription = await Subscription.findOneAndUpdate(
            { parentId },
            {
              parentId,
              planId,
              planName,
              status: 'active',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              startDate: new Date(subscription.current_period_start * 1000),
              endDate: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end
            },
            { upsert: true, new: true }
          );

          // Update parent's plan and subscription reference
          await Parent.findByIdAndUpdate(
            parentId,
            {
              plan: planName,
              subscriptionId: newSubscription._id
            }
          );

          console.log(`✅ Subscription activated for parent ${parentId}: ${planName}`);
        }
      } catch (error) {
        console.error('Error processing checkout session completed:', error);
      }
      break;

    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object;
      try {
        // Update subscription in our database
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionUpdated.id },
          {
            status: subscriptionUpdated.status,
            startDate: new Date(subscriptionUpdated.current_period_start * 1000),
            endDate: new Date(subscriptionUpdated.current_period_end * 1000),
            cancelAtPeriodEnd: subscriptionUpdated.cancel_at_period_end
          }
        );

        // Update parent's plan if needed
        const subscription = await Subscription.findOne({ 
          stripeSubscriptionId: subscriptionUpdated.id 
        });
        
        if (subscription) {
          await Parent.findByIdAndUpdate(
            subscription.parentId,
            { plan: subscription.planName }
          );
        }

        console.log(`✅ Subscription updated: ${subscriptionUpdated.id}`);
      } catch (error) {
        console.error('Error processing subscription updated:', error);
      }
      break;

    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object;
      try {
        // Update subscription status in our database
        const subscription = await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionDeleted.id },
          {
            status: 'cancelled',
            cancelledAt: new Date()
          }
        );

        // Update parent's plan to free
        if (subscription) {
          await Parent.findByIdAndUpdate(
            subscription.parentId,
            { plan: 'free', subscriptionId: null }
          );
        }

        console.log(`✅ Subscription cancelled: ${subscriptionDeleted.id}`);
      } catch (error) {
        console.error('Error processing subscription deleted:', error);
      }
      break;

    default:
      console.log(`⚠️ Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// @desc    Get current parent subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private
const getMySubscription = async (req, res) => {
  try {
    const parentId = req.parent._id;
    
    // Get parent with subscription info
    const parent = await Parent.findById(parentId)
      .select('-password -parentalPIN');
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get detailed subscription info
    let subscriptionDetails = null;
    let planDetails = null;

    if (parent.subscriptionId) {
      subscriptionDetails = await Subscription.findById(parent.subscriptionId);
      
      if (subscriptionDetails) {
        planDetails = await SubscriptionPlan.findById(subscriptionDetails.planId);
      }
    }

    // If no subscription, get the free plan details
    if (!planDetails) {
      planDetails = await SubscriptionPlan.findOne({ name: 'free' });
    }

    res.json({
      success: true,
      message: 'Current subscription retrieved successfully',
      data: {
        plan: parent.plan || 'free',
        subscription: subscriptionDetails || null,
        planDetails: planDetails || null
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving subscription',
      error: error.message
    });
  }
};

// @desc    Cancel current subscription
// @route   POST /api/subscriptions/cancel-subscription
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot cancel subscription.'
      });
    }

    const parentId = req.parent._id;

    // Get the subscription
    const subscription = await Subscription.findOne({
      parentId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Cancel the subscription in Stripe (at period end)
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update the subscription in our database
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date()
      },
      { new: true }
    ).populate('planId');

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      data: updatedSubscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling subscription',
      error: error.message
    });
  }
};

// @desc    Resume cancelled subscription
// @route   POST /api/subscriptions/resume-subscription
// @access  Private
const resumeSubscription = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot resume subscription.'
      });
    }

    const parentId = req.parent._id;

    // Get the cancelled subscription
    const subscription = await Subscription.findOne({
      parentId,
      cancelAtPeriodEnd: true
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No cancellable subscription found'
      });
    }

    // Resume the subscription in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    // Update the subscription in our database
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        status: 'active',
        cancelAtPeriodEnd: false,
        cancelledAt: null
      },
      { new: true }
    ).populate('planId');

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: updatedSubscription
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resuming subscription',
      error: error.message
    });
  }
};

module.exports = {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getMySubscription,
  cancelSubscription,
  resumeSubscription
};