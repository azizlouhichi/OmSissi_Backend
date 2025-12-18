# Subscription Plan Upgrade Functionality

## Overview
This feature allows parents to upgrade from the free plan to the basic or unlimited plans using Stripe for payment processing. The system includes:

- Three plan tiers: Free, Basic ($4.99/month), and Unlimited ($9.99/month)
- Stripe integration for secure payment processing
- Subscription lifecycle management (creation, cancellation, resumption)
- Plan-specific features and limitations

## Plan Tiers

### Free Plan
- Up to 2 child profiles
- Generate up to 5 stories per day
- Access to basic story generation
- Standard AI response time

### Basic Plan ($4.99/month)
- Up to 4 child profiles
- Generate up to 10 stories per day
- Access to advanced story themes
- Faster AI response time
- Priority customer support

### Unlimited Plan ($9.99/month)
- Up to 10 child profiles
- Generate up to 50 stories per day
- Unlimited story generation
- Premium AI response time
- Early access to new features
- 24/7 premium customer support

## Setup Instructions

### 1. Environment Variables
Add the following variables to your `.env` file:

```env
FRONTEND_URL=http://localhost:3000  # Your frontend application URL
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2. Stripe Configuration
1. Create a Stripe account at [https://stripe.com](https://stripe.com)
2. Get your API keys from the Stripe dashboard
3. Set up webhook endpoints pointing to `https://yourdomain.com/api/subscriptions/webhook`
4. Use the CLI or Stripe dashboard to listen for events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 3. Database Initialization
The system will automatically initialize the three plan types in the database when the server starts.

## API Endpoints

### Public Endpoints
- `GET /api/subscriptions/plans` - Retrieve all available subscription plans

### Protected Endpoints (require authentication)
- `GET /api/subscriptions/my-subscription` - Get current user's subscription details
- `POST /api/subscriptions/create-checkout-session` - Create a Stripe checkout session for plan upgrade
- `POST /api/subscriptions/cancel-subscription` - Cancel the current subscription (cancels at period end)
- `POST /api/subscriptions/resume-subscription` - Resume a cancelled subscription

### Webhook Endpoint (public)
- `POST /api/subscriptions/webhook` - Handle Stripe webhook events (requires proper webhook signature verification)

## Implementation Details

### Models
- `SubscriptionPlan`: Defines the different plan types with their features and pricing
- `Subscription`: Tracks individual user subscriptions with Stripe integration
- Updated `Parent` model: Now includes plan information and subscription references

### Controllers
- `subscriptionController.js`: Handles all subscription-related functionality

### Key Features
1. **Automatic Plan Assignment**: New users are automatically assigned to the free plan
2. **Stripe Integration**: Secure payment processing with customer management
3. **Subscription Lifecycle**: Full management of subscription states
4. **Plan Limitations**: The system enforces plan-specific limitations throughout the application
5. **Webhook Handling**: Automatic updates to subscription status based on Stripe events

## Frontend Integration

To add plan upgrade functionality to your frontend:

1. Fetch available plans: `GET /api/subscriptions/plans`
2. Show current subscription: `GET /api/subscriptions/my-subscription`
3. Create checkout session: `POST /api/subscriptions/create-checkout-session` with plan ID and name
4. Handle success/cancel redirects to your frontend URLs

## Testing

Run the subscription models test:
```bash
node test-subscription-models.js
```

## Security Considerations

- Webhook endpoints verify signatures to prevent unauthorized updates
- Subscription changes are properly validated against existing Stripe data
- Authentication is required for all subscription management endpoints
- Plan changes are properly validated before processing