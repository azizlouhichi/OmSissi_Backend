const Parent = require('../models/Parent');
const { Subscription, SubscriptionPlan } = require('../models/Subscription');
const { stripe } = require('../utils/stripe');

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
    console.error('❌ Get plans error:', error);
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
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Please contact the administrator.'
      });
    }

    const { planId, planName } = req.body;
    const parentId = req.parent._id;

    console.log('💳 Creating checkout session for:', { parentId, planName });

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
      console.log('📝 Creating new Stripe customer...');
      const customer = await stripe.customers.create({
        email: parent.email,
        name: `${parent.firstName} ${parent.lastName}`,
        metadata: {
          parentId: parent._id.toString()
        }
      });
      stripeCustomerId = customer.id;

      parent = await Parent.findByIdAndUpdate(
        parentId,
        { stripeCustomerId },
        { new: true }
      );
      console.log('✅ Stripe customer created:', stripeCustomerId);
    }

    // ✅ CORRECTION CRITIQUE: Utiliser des URLs web (pas des deep links!)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const successUrl = `${baseUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&parent_id=${parentId}`;
    const cancelUrl = `${baseUrl}/payment-cancel.html`;

    console.log('🔗 Redirect URLs:', { successUrl, cancelUrl });

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

    console.log('✅ Checkout session created:', session.id);

    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('❌ Create checkout session error:', error);
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

  // Handle the event
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

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ received: false, error: error.message });
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

  try {
    // Récupérer les détails de la subscription Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
    
    console.log('📦 Stripe subscription retrieved:', stripeSubscription.id);
    console.log('Status:', stripeSubscription.status);

    // Créer ou mettre à jour la subscription dans notre DB
    const subscription = await Subscription.findOneAndUpdate(
      { parentId },
      {
        parentId,
        planId,
        planName,
        status: stripeSubscription.status,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        startDate: new Date(stripeSubscription.current_period_start * 1000),
        endDate: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      },
      { upsert: true, new: true }
    );

    console.log('✅ Subscription saved in DB:', subscription._id);

    // ✅ CRITIQUE: Mettre à jour le plan du parent
    await Parent.findByIdAndUpdate(
      parentId,
      {
        plan: planName,
        subscriptionId: subscription._id
      }
    );

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
    const subscription = await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      {
        status: stripeSubscription.status,
        startDate: new Date(stripeSubscription.current_period_start * 1000),
        endDate: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      },
      { new: true }
    );

    if (subscription) {
      // Mettre à jour le plan du parent
      await Parent.findByIdAndUpdate(
        subscription.parentId,
        { plan: subscription.planName }
      );

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
    const subscription = await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { new: true }
    );

    if (subscription) {
      // Remettre le parent sur le plan free
      await Parent.findByIdAndUpdate(
        subscription.parentId,
        { plan: 'free', subscriptionId: null }
      );

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
      stripeSubscriptionId: invoice.subscription
    });

    if (subscription) {
      console.log(`⚠️ Payment failed for parent ${subscription.parentId}`);
      // Vous pouvez envoyer un email de notification ici
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
    const parentId = req.parent._id;
    
    const parent = await Parent.findById(parentId)
      .select('-password -parentalPIN');
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

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
    console.error('❌ Get subscription error:', error);
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
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot cancel subscription.'
      });
    }

    const parentId = req.parent._id;

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

    console.log('✅ Subscription cancelled:', subscription.stripeSubscriptionId);

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      data: updatedSubscription
    });
  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
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
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured. Cannot resume subscription.'
      });
    }

    const parentId = req.parent._id;

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

    console.log('✅ Subscription resumed:', subscription.stripeSubscriptionId);

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: updatedSubscription
    });
  } catch (error) {
    console.error('❌ Resume subscription error:', error);
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