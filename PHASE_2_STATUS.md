# PHASE 2: Monetization & Retention

**Goal:** Drive revenue + engagement through gamification, study plans, and subscription features.
**Effort:** ~12-15 hours
**Timeline:** 2-3 weeks

## Overview

PHASE 2 builds on PHASE 1's learner experience with monetization hooks (subscriptions, feature gates) and engagement mechanics (gamification, study plans). This is the revenue-enabling phase.

## Tasks (8 total)

### Task 1: Gamification UI - XP & Coins Display (2 hrs)
**Status:** Backend done, frontend pending
**Files:**
- Backend: `EntitlementService`, `GamificationLedger` entity
- Frontend: Wire `learner-dashboard-page` to display XP/coins from portal endpoint
- Create `xp-meter-card.jsx` and `coin-balance-card.jsx` components

**Implementation:**
```jsx
// Show XP progress bar (e.g., 2500/5000 towards level 5)
// Show coin balance with "+ coins" CTA for Pro features
// Add "Earn more" button linking to Pro features
```

**Done When:** Dashboard shows live XP/coin balances from `/api/learners/me/portal`

---

### Task 2: Leaderboards - Rank by XP (2 hrs)
**Status:** Backend queries ready, frontend needed
**Files:**
- Frontend: Create `leaderboard-page.jsx` with top 100 learners
- Wire to `/api/leaderboards/xp?limit=100`
- Show rank, name, XP, and streak

**Implementation:**
```jsx
// 1. Fetch learners ranked by XP
// 2. Highlight current user
// 3. Infinite scroll or pagination to 100
// 4. Show rank badge (gold/silver/bronze for top 3)
```

**Done When:** Leaderboard page live and accessible from dashboard

---

### Task 3: Study Plans - AI-Generated Schedules (4 hrs)
**Status:** AI service exists, UI/integration pending
**Files:**
- Backend: `StudyPlanService` (create if missing), `POST /api/study-plans/generate`
- Frontend: Create `study-plan-generator-page.jsx`
- Create `study-plan-card.jsx` for displaying schedules

**Implementation:**
```jsx
// 1. Learner selects goal (e.g., "Master React in 4 weeks")
// 2. Call /api/study-plans/generate with goal
// 3. AI returns structured plan (e.g., "Week 1: Hooks, Week 2: Context...")
// 4. Show as calendar/timeline
// 5. Allow tracking completion per week
```

**Endpoints:**
- `POST /api/study-plans/generate` - AI generates plan
- `GET /api/study-plans/my-plans` - Fetch user's plans
- `PUT /api/study-plans/{id}/complete-week` - Mark week as done

**Done When:** User can generate, view, and track study plans

---

### Task 4: Streaks & Daily Goals (1.5 hrs)
**Status:** Backend queries ready, UI pending
**Files:**
- Frontend: Create `streak-widget.jsx` component
- Show current streak, best streak, days until reset
- Add to dashboard

**Implementation:**
```jsx
// Display as badge: "🔥 5-day streak"
// Show next daily goal (e.g., "Complete 1 lesson")
// On completion, increment streak
```

---

### Task 5: PayMongo Subscription Flow (2 hrs)
**Status:** Backend integration done, checkout UI pending
**Files:**
- Frontend: Create `subscription-checkout-page.jsx`
- Create `pricing-card.jsx` for Pro tier
- Wire to PayMongo hosted checkout

**Implementation:**
```jsx
// 1. Show "Free" vs "Pro" pricing tiers
// 2. Pro includes: unlimited AI credits, study plans, offline access
// 3. Click "Upgrade to Pro" → PayMongo checkout
// 4. On success, redirect to dashboard with "Pro" badge
// 5. Show "Manage Subscription" link if already subscribed
```

**Endpoints:**
- `POST /api/payments/checkout` - Create PayMongo session
- `GET /api/payments/subscription-status` - Check current subscription

**Done When:** Users can checkout and receive Pro features

---

### Task 6: Pro Feature Gating (1 hr)
**Status:** Backend gates ready, UI integration pending
**Files:**
- Frontend: Add `ProOnly` wrapper component
- Use `EntitlementService` to check `isProSubscriber(learnerId)`
- Show paywall on Pro features

**Implementation:**
```jsx
// <ProOnly feature="UNLIMITED_AI_CREDITS">
//   <AIGenerationPanel />
// </ProOnly>
// Shows paywall if not Pro
```

**Done When:** Pro-only features show paywall for free users

---

### Task 7: Notification Preferences & Reminders (1.5 hrs)
**Status:** Backend notification service ready, prefs UI pending
**Files:**
- Frontend: Create `notification-preferences-page.jsx`
- Allow enabling/disabling: daily reminders, streak resets, new comments

**Implementation:**
```jsx
// Toggles for:
// - Daily study reminder (time picker)
// - Streak reset reminder (when streak about to expire)
// - Social notifications (when someone likes post)
// - Achievement badges earned
```

**Done When:** Users can customize notification preferences

---

### Task 8: Revenue Dashboard (Admin) (1 hr)
**Status:** Backend endpoints exist, admin UI pending
**Files:**
- Frontend: Create `admin-revenue-dashboard-page.jsx` (admin-only)
- Show: total revenue, active subscriptions, churn rate

**Implementation:**
```jsx
// Display:
// - Total MRR (Monthly Recurring Revenue)
// - Active Pro subscribers
// - Churn rate (last 30 days)
// - Payment method breakdown
```

**Done When:** Admin can view revenue metrics

---

## Architecture Notes

### Gamification Ledger
All XP/coin/badge changes flow through `GamificationLedger` for audit trail:
```java
GamificationLedger {
  learnerId, action, pointsChange, coinChange, metadata
}
```

### Subscription Model
```java
LearnerSubscription {
  learnerId, status (ACTIVE/EXPIRED/CANCELLED), paidAmount,
  billingPeriodStart, billingPeriodEnd, features[]
}
```

### PayMongo Webhook Flow
```
PayMongo → /api/webhooks/paymongo
→ PaymentWebhookService.handleChargeUpdated()
→ Create/update LearnerSubscription
→ Grant entitlements via EntitlementService
```

## Integration Checklist

- [ ] Task 1: Dashboard displays live gamification data
- [ ] Task 2: Leaderboard page built and ranked
- [ ] Task 3: Study plan generation + UI complete
- [ ] Task 4: Streaks tracked and displayed
- [ ] Task 5: PayMongo checkout functional
- [ ] Task 6: Pro features gated and showing paywall
- [ ] Task 7: Notification preferences saved
- [ ] Task 8: Admin revenue dashboard live
- [ ] All Pro features marked as `@PreAuthorize("@entitlementService.hasAccess(principal, 'FEATURE_CODE')")`
- [ ] Test full payment flow end-to-end

## Database Migrations Needed

- `learner_subscription` table (if not present)
- `gamification_ledger` table (if not present)
- `study_plan` and `study_plan_week` tables
- `notification_preference` table

## Frontend Routes to Add

```
/dashboard - Gamification cards + leaderboard link
/leaderboard - XP rankings
/study-plans - Study plan management
/subscription - PayMongo checkout
/settings/notifications - Notification prefs
/admin/revenue - Revenue dashboard (admin only)
```

## Success Metrics

✅ Users can upgrade to Pro
✅ Pro features are gated and enforce limits
✅ At least 50% of active learners have attempted gamification features
✅ MRR > $0 (any subscription = success)
✅ Streak mechanic drives 30%+ daily active users back

---

## Next Steps

1. **Start Task 1-2** (quick wins): Gamification UI + Leaderboards
2. **Task 3** (high impact): Study plan generation
3. **Tasks 4-6** (monetization): Streaks, payments, gating
4. **Tasks 7-8** (polish): Notifications + admin dashboard

Estimated completion: 2-3 weeks with full focus.
