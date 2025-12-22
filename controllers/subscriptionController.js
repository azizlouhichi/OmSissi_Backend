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
      success_url: `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription-cancel`,
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
        // Retrieve the session to get the metadata
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items']
        });

        const parentId = session.metadata?.parentId;
        const planId = session.metadata?.planId;
        const planName = session.metadata?.planName;

        if (parentId && planId && planName) {
          // Create or update subscription in our database
          const subscription = await stripe.subscriptions.retrieve(session.subscription);

          // Update parent's plan
          await Parent.findByIdAndUpdate(
            parentId,
            {
              plan: planName,
              subscriptionId: null // Will be set after creating the subscription record
            }
          );

          // Create or update subscription record
          await Subscription.findOneAndUpdate(
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

          console.log(`Subscription updated for parent ${parentId}: ${planName}`);
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
        const parent = await Parent.findOne({ stripeCustomerId: subscriptionUpdated.customer });
        if (parent) {
          await Parent.findByIdAndUpdate(
            parent._id,
            { plan: subscriptionUpdated.plan.nickname.toLowerCase() }
          );
        }
      } catch (error) {
        console.error('Error processing subscription updated:', error);
      }
      break;

    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object;
      try {
        // Update subscription status in our database
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionDeleted.id },
          {
            status: 'cancelled',
            cancelledAt: new Date()
          }
        );

        // Update parent's plan to free
        const parent = await Parent.findOne({ stripeCustomerId: subscriptionDeleted.customer });
        if (parent) {
          await Parent.findByIdAndUpdate(
            parent._id,
            { plan: 'free' }
          );
        }
      } catch (error) {
        console.error('Error processing subscription deleted:', error);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
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
      .populate('subscriptionId', 'planId planName status startDate endDate cancelAtPeriodEnd')
      .select('-password -parentalPIN');
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get detailed subscription info
    let subscriptionDetails = null;
    if (parent.subscriptionId) {
      subscriptionDetails = await Subscription.findById(parent.subscriptionId._id)
        .populate('planId');
    }

    // Also get the plan details if not populated
    let planDetails = null;
    if (!subscriptionDetails) {
      planDetails = await SubscriptionPlan.findOne({ name: parent.plan });
    }

    res.json({
      success: true,
      message: 'Current subscription retrieved successfully',
      data: {
        plan: parent.plan,
        subscription: subscriptionDetails || null,
        planDetails: subscriptionDetails ? subscriptionDetails.planId : planDetails
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

    // Cancel the subscription in Stripe
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    } catch (stripeError) {
      console.error('Error cancelling subscription in Stripe:', stripeError);
      // Continue with database update even if Stripe call fails
    }

    // Update the subscription in our database
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        cancelledAt: new Date()
      },
      { new: true }
    ).populate('planId');

    // Update parent's plan to free if subscription is cancelled immediately
    if (!updatedSubscription.cancelAtPeriodEnd) {
      await Parent.findByIdAndUpdate(
        parentId,
        { plan: 'free' }
      );
    }

    res.json({
      success: true,
      message: 'Subscription cancellation initiated successfully',
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
      status: 'cancelled',
      cancelAtPeriodEnd: true
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No cancellable subscription found'
      });
    }

    // Resume the subscription in Stripe
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false
      });
    } catch (stripeError) {
      console.error('Error resuming subscription in Stripe:', stripeError);
      // Continue with database update even if Stripe call fails
    }

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

    // Update parent's plan
    await Parent.findByIdAndUpdate(
      parentId,
      { plan: updatedSubscription.planName }
    );

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

// (exports moved to bottom of file after all function definitions)

// @desc    Get a single subscription plan by ID (Admin)
// @route   GET /api/subscription-plans/:id
// @access  Private/Admin
const getPlanById = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get plan by id error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving plan' });
  }
};

// @desc    Create a new subscription plan (Admin)
// @route   POST /api/subscription-plans
// @access  Private/Admin
const createPlan = async (req, res) => {
  try {
    const { name, displayName, price, currency, interval, features, maxChildren, maxStoriesPerMonth, aiGenerationPriority, isActive } = req.body;

    // Basic validation
    if (!name || !displayName || price === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, displayName, price' });
    }

    const existing = await SubscriptionPlan.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Plan with this name already exists' });
    }

    const plan = await SubscriptionPlan.create({
      name,
      displayName,
      price,
      currency: currency || 'usd',
      interval: interval || 'month',
      features: features || [],
      maxChildren: maxChildren ?? 1,
      maxStoriesPerMonth: maxStoriesPerMonth ?? 150,
      aiGenerationPriority: aiGenerationPriority || 'medium',
      isActive: isActive !== false
    });

    res.status(201).json({ success: true, message: 'Plan created', data: plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ success: false, message: 'Server error creating plan', error: error.message });
  }
};

// @desc    Update a subscription plan (Admin)
// @route   PUT /api/subscription-plans/:id
// @access  Private/Admin
const updatePlanById = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const updateData = req.body;
    Object.assign(plan, updateData);
    await plan.save();

    res.json({ success: true, message: 'Plan updated', data: plan });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ success: false, message: 'Server error updating plan', error: error.message });
  }
};

// @desc    Delete a subscription plan (Admin)
// @route   DELETE /api/subscription-plans/:id
// @access  Private/Admin
const deletePlanById = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    await SubscriptionPlan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting plan', error: error.message });
  }
};

// (exports moved to bottom of file)

// @desc    Admin: list subscriptions with optional filters
// @route   GET /api/subscriptions
// @access  Private/Admin
const getSubscriptions = async (req, res) => {
  try {
    const { planId = '', status = '' } = req.query;
    const query = {};
    if (planId) query.planId = planId;
    if (status) query.status = status;

    const subs = await Subscription.find(query)
      .populate('planId')
      .populate('parentId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: subs });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving subscriptions', error: error.message });
  }
};

// @desc    Admin: compute subscription stats
// @route   GET /api/subscriptions/stats
// @access  Private/Admin
const getSubscriptionStats = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().lean();
    const plans = await SubscriptionPlan.find().lean();

    const totalSubscribers = subscriptions.length;
    const activeSubscribers = subscriptions.filter(s => s.status === 'active').length;

    let revenue = 0;
    const plansDistribution = {};

    subscriptions.forEach(sub => {
      const plan = plans.find(p => p._id && p._id.toString() === (sub.planId && sub.planId.toString ? sub.planId.toString() : (sub.planId && sub.planId._id ? sub.planId._id.toString() : '')));
      if (plan && plan.price) revenue += Number(plan.price) || 0;
      const name = (plan && (plan.displayName || plan.name)) || (sub.planName || 'unknown');
      plansDistribution[name] = (plansDistribution[name] || 0) + 1;
    });

    // Convert distribution to percentages
    Object.keys(plansDistribution).forEach(name => {
      const count = plansDistribution[name];
      plansDistribution[name] = {
        count,
        percentage: totalSubscribers > 0 ? ((count / totalSubscribers) * 100).toFixed(1) : 0
      };
    });

    res.json({
      success: true,
      data: {
        totalSubscribers,
        activeSubscribers,
        revenue,
        plansDistribution
      }
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ success: false, message: 'Server error computing stats', error: error.message });
  }
};

// @desc    Admin: update a subscription by id
// @route   PUT /api/subscriptions/:id
// @access  Private/Admin
const updateSubscriptionById = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });

    // Allow admin to update status, endDate, cancelAtPeriodEnd, or other safe fields
    const allowed = ['status', 'endDate', 'startDate', 'cancelAtPeriodEnd', 'cancelledAt', 'planId', 'planName', 'autoRenew'];
    Object.keys(req.body).forEach(key => {
      if (allowed.includes(key)) {
        subscription[key] = req.body[key];
      }
    });

    await subscription.save();
    const populated = await Subscription.findById(subscription._id).populate('planId').populate('parentId', 'firstName lastName email');
    res.json({ success: true, message: 'Subscription updated', data: populated });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error updating subscription', error: error.message });
  }
};

  // Final exports (all controller methods)
  module.exports = {
    getAvailablePlans,
    createCheckoutSession,
    handleWebhook,
    getMySubscription,
    cancelSubscription,
    resumeSubscription,
    // Admin plan CRUD
    getPlanById,
    createPlan,
    updatePlanById,
    deletePlanById,
    // Admin subscriptions
    getSubscriptions,
    getSubscriptionStats,
    updateSubscriptionById
  };