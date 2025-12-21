const Parent = require('../models/Parent');
const { Subscription, SubscriptionPlan } = require('../models/Subscription');
const { stripe } = require('../utils/stripe');
const mongoose = require('mongoose');

// =================== HELPERS ===================
function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// @desc    Get available subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
const getAvailablePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });

    res.json({
      success: true,
      message: 'Available subscription plans retrieved successfully',
      data: plans,
    });
  } catch (error) {
    console.error('❌ Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving plans',
      error: error.message,
    });
  }
};

// @desc    Create a checkout session for plan upgrade
// @route   POST /api/subscriptions/create-checkout-session
// @access  Private
const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Please contact the administrator.',
      });
    }

    const { planId, planName } = req.body;
    const parentId = req.parent?._id;

    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    console.log('💳 Creating checkout session for:', { parentId, planName });

    const plan = await SubscriptionPlan.findOne({
      _id: planId,
      name: planName,
      isActive: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Selected plan not found or not available',
      });
    }

    let parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    let stripeCustomerId = parent.stripeCustomerId;

    if (!stripeCustomerId) {
      console.log('📝 Creating new Stripe customer...');
      const customer = await stripe.customers.create({
        email: parent.email,
        name: `${parent.firstName} ${parent.lastName}`,
        metadata: {
          parentId: parent._id.toString(),
        },
      });
      stripeCustomerId = customer.id;

      parent = await Parent.findByIdAndUpdate(parentId, { stripeCustomerId }, { new: true });
      console.log('✅ Stripe customer created:', stripeCustomerId);
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const successUrl = `${baseUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&parent_id=${parentId}`;
    const cancelUrl = `${baseUrl}/payment-cancel.html`;

    console.log('🔗 Redirect URLs:', { successUrl, cancelUrl });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.displayName,
              description: (plan.features || []).join(', '),
            },
            unit_amount: plan.price,
            recurring: { interval: plan.interval },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        parentId: parentId.toString(),
        planId: planId.toString(),
        planName: planName,
      },
    });

    console.log('✅ Checkout session created:', session.id);

    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: { sessionId: session.id, url: session.url },
    });
  } catch (error) {
    console.error('❌ Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating checkout session',
      error: error.message,
    });
  }
};

// @desc    Handle Stripe webhook for subscription updates
// @route   POST /api/subscriptions/webhook
// @access  Public
const handleWebhook = async (req, res) => {
  if (!stripe) {
    console.error('❌ Stripe not configured, cannot process webhook');
    return res.status(500).json({ received: false, error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ received: false, error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook signature verified:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log('✅ Invoice payment succeeded:', event.data.object.id);
        break;

      case 'invoice.payment_failed':
        console.log('❌ Invoice payment failed:', event.data.object.id);
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return res.status(500).json({ received: false, error: error.message });
  }
};

// ================= WEBHOOK HANDLERS =================

async function handleCheckoutSessionCompleted(session) {
  console.log('🔄 Processing checkout.session.completed...');
  console.log('Session ID:', session.id);

  const parentId = session.metadata?.parentId;
  const planId = session.metadata?.planId;
  const planName = session.metadata?.planName;

  if (!parentId || !planId || !planName) {
    console.error('❌ Missing metadata in session:', session.id);
    console.error('Metadata:', session.metadata);
    return;
  }

  const parentObjectId = toObjectId(parentId);
  const planObjectId = toObjectId(planId);

  if (!parentObjectId || !planObjectId) {
    console.error('❌ Invalid ObjectId(s):', { parentId, planId });
    return;
  }

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);

    console.log('📦 Stripe subscription retrieved:', stripeSubscription.id);
    console.log('Status:', stripeSubscription.status);

    const subscriptionData = {
      parentId: parentObjectId,
      planId: planObjectId,
      planName,
      status: stripeSubscription.status,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      startDate: new Date(stripeSubscription.current_period_start * 1000),
      endDate: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: !!stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    };

    const result = await Subscription.collection.findOneAndUpdate(
      { parentId: parentObjectId },
      { $set: subscriptionData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    const saved = result?.value;
    if (!saved?._id) {
      console.error('❌ Subscription not saved properly');
      return;
    }

    console.log('✅ Subscription saved in DB:', saved._id.toString());

    await Parent.findByIdAndUpdate(parentObjectId, {
      plan: planName,
      subscriptionId: saved._id,
    });

    console.log(`✅ Parent ${parentId} plan updated to: ${planName}`);
  } catch (error) {
    console.error('❌ Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(stripeSubscription) {
  console.log('🔄 Processing subscription.updated...');
  console.log('Subscription ID:', stripeSubscription.id);
  console.log('New status:', stripeSubscription.status);

  try {
    const updateData = {
      status: stripeSubscription.status,
      startDate: new Date(stripeSubscription.current_period_start * 1000),
      endDate: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: !!stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    };

    const result = await Subscription.collection.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    const updated = result?.value;
    if (updated) {
      await Parent.findByIdAndUpdate(updated.parentId, { plan: updated.planName });
      console.log(`✅ Subscription ${stripeSubscription.id} updated`);
    } else {
      console.error('❌ Subscription not found in DB:', stripeSubscription.id);
    }
  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdated:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(stripeSubscription) {
  console.log('🔄 Processing subscription.deleted...');
  console.log('Subscription ID:', stripeSubscription.id);

  try {
    const updateData = {
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await Subscription.collection.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    const updated = result?.value;
    if (updated) {
      await Parent.findByIdAndUpdate(updated.parentId, {
        plan: 'free',
        subscriptionId: null,
      });
      console.log(`✅ Subscription ${stripeSubscription.id} cancelled, parent reverted to free`);
    } else {
      console.error('❌ Subscription not found in DB:', stripeSubscription.id);
    }
  } catch (error) {
    console.error('❌ Error in handleSubscriptionDeleted:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice) {
  console.log('❌ Payment failed for invoice:', invoice.id);

  try {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: invoice.subscription,
    });

    if (subscription) {
      console.log(`⚠️ Payment failed for parent ${subscription.parentId}`);
      // TODO: send email / notify parent
    }
  } catch (error) {
    console.error('❌ Error in handlePaymentFailed:', error);
  }
}

// @desc    Get current parent subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private
const getMySubscription = async (req, res) => {
  try {
    const parentId = req.parent?._id;

    const parent = await Parent.findById(parentId).select('-password -parentalPIN');
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    let subscriptionDetails = null;
    let planDetails = null;

    if (parent.subscriptionId) {
      subscriptionDetails = await Subscription.findById(parent.subscriptionId);
      if (subscriptionDetails) {
        planDetails = await SubscriptionPlan.findById(subscriptionDetails.planId);
      }
    }

    if (!planDetails) {
      planDetails = await SubscriptionPlan.findOne({ name: 'free' });
    }

    res.json({
      success: true,
      message: 'Current subscription retrieved successfully',
      data: {
        plan: parent.plan || 'free',
        subscription: subscriptionDetails || null,
        planDetails: planDetails || null,
      },
    });
  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving subscription',
      error: error.message,
    });
  }
};

// @desc    Cancel current subscription
// @route   POST /api/subscriptions/cancel-subscription
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot cancel subscription.',
      });
    }

    const parentId = req.parent?._id;

    const subscription = await Subscription.findOne({ parentId, status: 'active' });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await Subscription.collection.updateOne(
      { _id: subscription._id },
      { $set: { cancelAtPeriodEnd: true, cancelledAt: new Date(), updatedAt: new Date() } }
    );

    const updatedSubscription = await Subscription.findById(subscription._id).populate('planId');

    console.log('✅ Subscription cancelled:', subscription.stripeSubscriptionId);

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      data: updatedSubscription,
    });
  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling subscription',
      error: error.message,
    });
  }
};

// @desc    Resume cancelled subscription
// @route   POST /api/subscriptions/resume-subscription
// @access  Private
const resumeSubscription = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot resume subscription.',
      });
    }

    const parentId = req.parent?._id;

    const subscription = await Subscription.findOne({ parentId, cancelAtPeriodEnd: true });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No cancellable subscription found' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscription._id,
      { status: 'active', cancelAtPeriodEnd: false, cancelledAt: null },
      { new: true }
    ).populate('planId');

    console.log('✅ Subscription resumed:', subscription.stripeSubscriptionId);

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: updatedSubscription,
    });
  } catch (error) {
    console.error('❌ Resume subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error resuming subscription',
      error: error.message,
    });
  }
};

// @desc    Get all subscriptions (Admin)
// @route   GET /api/subscriptions/all
// @access  Private
const getAllSubscriptions = async (req, res) => {
  try {
    const { status, planName, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (planName) filter.planName = planName;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subscriptions = await Subscription.find(filter)
      .populate('parentId', 'firstName lastName email')
      .populate('planId', 'displayName price currency interval')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Subscription.countDocuments(filter);

    res.json({
      success: true,
      message: 'All subscriptions retrieved successfully',
      data: {
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalSubscriptions: total,
          perPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('❌ Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving subscriptions',
      error: error.message,
    });
  }
};

// @desc    Get subscription statistics
// @route   GET /api/subscriptions/stats
// @access  Private
const getSubscriptionStats = async (req, res) => {
  try {
    const statusStats = await Subscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const planStats = await Subscription.aggregate([
      {
        $group: {
          _id: '$planName',
          count: { $sum: 1 },
        },
      },
    ]);

    const activeSubscriptions = await Subscription.find({ 
      status: 'active' 
    }).populate('planId');

    let monthlyRevenue = 0;
    activeSubscriptions.forEach(sub => {
      if (sub.planId && sub.planId.price) {
        const price = sub.planId.price / 100;
        if (sub.planId.interval === 'month') {
          monthlyRevenue += price;
        } else if (sub.planId.interval === 'year') {
          monthlyRevenue += price / 12;
        }
      }
    });

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const endingSoon = await Subscription.countDocuments({
      status: 'active',
      endDate: { $lte: thirtyDaysFromNow },
      cancelAtPeriodEnd: false,
    });

    const pendingCancellation = await Subscription.countDocuments({
      status: 'active',
      cancelAtPeriodEnd: true,
    });

    res.json({
      success: true,
      message: 'Subscription statistics retrieved successfully',
      data: {
        byStatus: statusStats,
        byPlan: planStats,
        revenue: {
          estimatedMonthlyRevenue: monthlyRevenue.toFixed(2),
          currency: 'EUR',
        },
        alerts: {
          endingSoon,
          pendingCancellation,
        },
      },
    });
  } catch (error) {
    console.error('❌ Get subscription stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving statistics',
      error: error.message,
    });
  }
};

// @desc    Get subscription by ID
// @route   GET /api/subscriptions/:id
// @access  Private
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id)
      .populate('parentId', 'firstName lastName email')
      .populate('planId');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    res.json({
      success: true,
      message: 'Subscription retrieved successfully',
      data: subscription,
    });
  } catch (error) {
    console.error('❌ Get subscription by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving subscription',
      error: error.message,
    });
  }
};

module.exports = {
  getAvailablePlans,
  createCheckoutSession,
  handleWebhook,
  getMySubscription,
  cancelSubscription,
  resumeSubscription,
  getAllSubscriptions,
  getSubscriptionStats,
  getSubscriptionById,
};