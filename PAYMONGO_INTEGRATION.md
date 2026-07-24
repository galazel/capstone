# PayMongo Hosted Checkout Integration

## Overview

REBYU is integrated with **PayMongo Hosted Checkout** for secure payment processing in test mode.

**Test Keys:**
- **Secret Key:** set `PAYMONGO_SECRET_KEY` in your environment; never commit it.
- **Public Key:** set `PAYMONGO_PUBLIC_KEY` in your environment.
- **Payment Methods Available:** Card, GCash, PayMaya

## Architecture

### Backend Flow

1. **Endpoint:** `POST /api/subscription/checkout/{planId}`
   - Learner initiates checkout
   - Backend creates PayMongo hosted checkout session
   - Returns `checkout_url` to redirect learner

2. **PayMongo Hosted Checkout**
   - Learner completes payment on PayMongo's page
   - Redirects to success/cancel URLs

3. **Webhook Handler:** `POST /api/webhooks/paymongo`
   - PayMongo sends payment events
   - `charge.succeeded` → Activates learner subscription
   - `subscription.payment.successful` → Extends subscription period
   - `subscription.payment.failed` → Marks subscription as failed

4. **Entitlement Checks:**
   - `EntitlementService.hasAccess(learnerId, "FEATURE_CODE")`
   - Returns true if learner has active paid subscription

### Frontend Flow

```javascript
// 1. Get available plans
const plans = await paymongoService.getPlans()

// 2. Initiate checkout (redirects to PayMongo)
await paymongoService.initiateCheckout(planId)

// 3. After payment, verify status
const result = await paymongoService.verifyPayment(sessionId)
// Returns: { status: "success", message: "Payment successful" }
```

## Configuration

**File:** `application-paymongo-test.yml`

```yaml
paymongo:
  enabled: ${PAYMONGO_ENABLED:true}
  secret-key: ${PAYMONGO_SECRET_KEY:}
  public-key: ${PAYMONGO_PUBLIC_KEY:}
  base-url: https://api.paymongo.com/v1

app:
  frontend-url: http://localhost:5173  # For redirects
```

**Run with:**
```bash
java -jar app.jar --spring.profiles.active=paymongo-test
```

## Test Payment Methods

**PayMongo Test Mode supports:**

| Method | Card Number | Details |
|--------|------------|---------|
| Visa | 4343434343434345 | Exp: Any future date, Any CVV |
| Mastercard | 5555555555554444 | Exp: Any future date, Any CVV |
| GCash | Any 11-digit number | Use 09xxxxxxxxx format |
| PayMaya | Any 12-digit number | Use 05xxxxxxxxxx format |

**All test payments succeed immediately** (no 3D Secure).

## Testing Webhook Events

PayMongo webhooks are sent to: `https://your-domain/api/webhooks/paymongo`

**Test webhook in PayMongo dashboard:**
1. Go to Developers → Webhooks
2. Select event type (e.g., `charge.succeeded`)
3. Click "Send Test Event"
4. Check application logs for webhook processing

**Webhook Events Handled:**
- `charge.succeeded` → Payment received
- `charge.failed` → Payment failed
- `subscription.updated` → Plan change
- `subscription.payment.successful` → Renewal payment succeeded
- `subscription.payment.failed` → Renewal payment failed

## Entitlements & Feature Gates

After successful payment, learner gains access to Pro features:

```java
// Check if learner can access a feature
if (entitlementService.hasAccess(learnerId, "DETAILED_PROGRESS")) {
    // Show detailed analytics
}

// Get limit values (e.g., seat count)
Integer seatLimit = entitlementService.getLimitValue(learnerId, "SEAT_LIMIT");
```

**Available Entitlements:**
- `DETAILED_PROGRESS` - Analytics dashboards
- `MASTERY_ANALYTICS` - BKT-powered insights
- `PERSONALIZED_STUDY_PLAN` - AI study recommendations
- `MOCK_EXAM_ACCESS` - Practice exams
- (See `Entitlements.java` for full list)

## Database Schema

**learner_subscriptions** table:
```
- learner_id (FK)
- subscription_plan_id (FK)
- provider: "PAYMONGO"
- provider_subscription_id: PayMongo checkout/subscription ID
- status: ACTIVE, PENDING, CANCELED, PAYMENT_FAILED, EXPIRED
- current_period_start/end: Active billing period
- canceled_at: When user canceled
```

**plan_entitlements** table:
```
- subscription_plan_id (FK)
- entitlement_code: "DETAILED_PROGRESS", etc.
- enabled: true/false
- limit_value: For limits like SEAT_LIMIT=75
```

## Deployment Checklist

- [ ] Add PayMongo test keys to environment variables (never `application.yml`)
- [ ] Enable PayMongo in `application.yml`: `paymongo.enabled: true`
- [ ] Update redirect URLs in `app.frontend-url`
- [ ] Configure webhook endpoint in PayMongo dashboard
- [ ] Add CORS allowlist for PayMongo domain (if needed)
- [ ] Test with test payment cards
- [ ] Verify webhooks are being received in logs
- [ ] Test subscription status updates in learner dashboard
- [ ] Test entitlement gates (feature access)

## Troubleshooting

**Webhook not received:**
- Check PayMongo dashboard for delivery logs
- Verify endpoint is accessible from internet
- Check firewall/security group allows PayMongo IPs
- Look for errors in application logs

**Payment shows pending:**
- PayMongo processes asynchronously; wait for webhook
- Check webhook handler for errors
- Manually trigger test webhook in PayMongo dashboard

**Learner can't access Pro features:**
- Verify webhook was processed: `SELECT * FROM learner_subscriptions WHERE learner_id = ?`
- Check subscription status: `SELECT status FROM learner_subscriptions...`
- Verify entitlement mapping: `SELECT * FROM plan_entitlements...`
- Check feature gate code: `entitlementService.hasAccess()`

## Production Setup

When moving to production:

1. **Use Live Keys** from PayMongo dashboard
   - Secret: `sk_live_*`
   - Public: `pk_live_*`

2. **Update URLs:**
   - `paymongo.base-url: https://api.paymongo.com/v1` (stays same)
   - `app.frontend-url: https://your-production-domain`

3. **Enable Webhook Signature Verification:**
   - PayMongo sends `X-Paymongo-Signature` header
   - Verify with your webhook secret before processing

4. **Handle Real Delays:**
   - Payments may take time to settle
   - Subscription period reconciliation may be async

## References

- [PayMongo Hosted Checkout Docs](https://developers.paymongo.com/docs/hosted-checkout)
- [PayMongo Webhooks](https://developers.paymongo.com/docs/webhooks)
- [PayMongo Test Cards](https://developers.paymongo.com/docs/test-cards)
