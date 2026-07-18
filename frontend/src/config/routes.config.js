/**
 * REBYU Application Routes Configuration
 * PHASE 1 + PHASE 2 Complete Feature Map
 */

export const ROUTES = {
  // Public
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',

  // Learner - Dashboard & Core
  DASHBOARD: '/dashboard',
  DASHBOARD_ENHANCED: '/dashboard/enhanced',
  PROFILE_SETTINGS: '/settings/profile',

  // PHASE 1: Core Learning Experience
  ASSESSMENT_ATTEMPT: '/assessment/attempt',
  ASSESSMENT_RESULTS: '/assessment/:attemptId/results',
  LESSONS: '/lessons',
  LESSON_VIEW: '/lessons/:id',

  // PHASE 2: Gamification & Engagement
  LEADERBOARD: '/leaderboard',
  STREAKS: '/streaks',
  STUDY_PLANS: '/study-plans',
  STUDY_PLAN_VIEW: '/study-plans/:id',

  // PHASE 2: Settings & Preferences
  NOTIFICATION_PREFERENCES: '/settings/notifications',

  // PHASE 2: Monetization
  SUBSCRIPTION: '/subscription',
  CHECKOUT_SUCCESS: '/subscription/success',
  CHECKOUT_CANCEL: '/subscription/cancel',

  // Community
  COMMUNITY: '/community',
  COMMUNITY_POST_VIEW: '/community/posts/:id',
  COMMUNITY_POST_EDIT: '/community/posts/:id/edit',
  COMMUNITY_POST_CREATE: '/community/posts/new',

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_REVENUE: '/admin/revenue',
  ADMIN_USERS: '/admin/users',
}

/**
 * Feature Checklist - All 15 tasks completed
 *
 * PHASE 1 (7/7 complete):
 * ✅ 1. Dashboard - Portal endpoint with aggregated learner state
 * ✅ 2. Profile Management - Email, password, account deletion
 * ✅ 3. Assessment Attempt - Quiz flow with multiple question types
 * ✅ 4. Lesson Completion - Progress tracking
 * ✅ 5. BKT Mastery - Visual indicator (0-4 levels, color-coded)
 * ✅ 6. Notifications - Fetch and mark-as-read
 * ✅ 7. Community Edit/Delete - Post ownership enforcement
 *
 * PHASE 2 (8/8 complete):
 * ✅ 1. Gamification UI - XP, coins, badges display
 * ✅ 2. Leaderboards - Top 100 by XP ranking
 * ✅ 3. Study Plans - AI-generated learning schedules
 * ✅ 4. Streaks - Daily activity tracking
 * ✅ 5. PayMongo - Subscription checkout integration
 * ✅ 6. Pro Gating - Feature paywall component
 * ✅ 7. Notification Prefs - User-customizable settings
 * ✅ 8. Admin Revenue - Dashboard with MRR/churn metrics
 */

export const PHASE_1_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.PROFILE_SETTINGS,
  ROUTES.ASSESSMENT_ATTEMPT,
  ROUTES.LESSONS,
  ROUTES.COMMUNITY_POST_EDIT,
]

export const PHASE_2_ROUTES = [
  ROUTES.LEADERBOARD,
  ROUTES.STREAKS,
  ROUTES.STUDY_PLANS,
  ROUTES.NOTIFICATION_PREFERENCES,
  ROUTES.SUBSCRIPTION,
  ROUTES.ADMIN_REVENUE,
]

export const ALL_ROUTES = [
  ...Object.values(ROUTES),
  ...PHASE_1_ROUTES,
  ...PHASE_2_ROUTES,
]
