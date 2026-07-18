# PHASE 5: Pre-Launch Critical (Launch Blocker)

**Goal:** Everything needed to launch to production safely.
**Effort:** 15-20 hours
**Timeline:** 3-5 days (intensive sprint)
**Status:** MUST COMPLETE before go-live

## Overview

PHASE 5 is NOT a feature phase—it's the critical "launch readiness" phase. No new features, just making existing features production-ready.

---

## Tasks (9 total)

### Task 1: Database Migrations & Seeding (2 hrs)
**Priority:** P0 - CRITICAL

**SQL Scripts Needed:**
```sql
-- 7 new tables
1. CREATE TABLE streak
2. CREATE TABLE study_plan
3. CREATE TABLE notification_preference
4. CREATE TABLE organization
5. CREATE TABLE team_member
6. CREATE TABLE audit_log
7. CREATE TABLE organization_billing

-- Create indexes for performance
CREATE INDEX idx_user_org ON team_member(learner_id, org_id)
CREATE INDEX idx_streak_learner ON streak(learner_id)
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC)
...

-- Seed test data
INSERT INTO organization VALUES (1, 'Test Org', 'test.com', ...)
INSERT INTO team_member VALUES (1, 1, 1, 'ADMIN', ...)
...
```

**Migration Tool:** Flyway or Liquibase
- Version control SQL scripts
- Rollback capability
- Automatic schema updates on deploy

**Deliverables:**
- ✅ V001__create_streak_table.sql
- ✅ V002__create_study_plan_table.sql
- ✅ V003__create_organization_tables.sql
- ✅ V004__create_audit_log_table.sql
- ✅ V005__create_indexes.sql
- ✅ V006__seed_test_data.sql
- ✅ Rollback scripts for each

**Done When:** `flyway migrate` runs successfully, all tables created

---

### Task 2: React Router Complete Setup (2 hrs)
**Priority:** P0 - CRITICAL

**Current State:** Pages exist but not routed

**Implementation:**
```jsx
// src/App.jsx - main router config
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/protected-route'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Learner routes (protected) */}
        <Route element={<ProtectedRoute role="LEARNER" />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/study-plans" element={<StudyPlanPage />} />
          <Route path="/assessment/attempt" element={<AssessmentAttemptPage />} />
          <Route path="/assessment/:id/results" element={<AssessmentResultsPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/posts/:id/edit" element={<PostEditorPage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/revenue" element={<RevenueDashboardPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**ProtectedRoute Component:**
```jsx
export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />

  if (!user) return <Navigate to="/login" replace />

  if (role && !hasRole(user, role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
```

**Deliverables:**
- ✅ src/App.jsx with complete routing
- ✅ src/components/protected-route.jsx
- ✅ src/components/not-found-page.jsx
- ✅ src/components/unauthorized-page.jsx
- ✅ Navigation component with active route highlighting
- ✅ Breadcrumb navigation

**Done When:** All 15 pages accessible via URL, authentication enforced

---

### Task 3: Email Service Integration (2 hrs)
**Priority:** P0 - CRITICAL

**Service:** SendGrid or Mailgun

**Setup:**
```java
// EmailService.java
@Service
public class EmailService {
  private final SendGridClient sendGrid;

  public void sendPasswordReset(String email, String token) {
    Email from = new Email("noreply@rebyu.com");
    Subject subject = new Subject("Reset Your Password");
    Email to = new Email(email);
    Content content = new Content("text/html",
      "<h1>Reset Password</h1><a href='https://rebyu.com/reset?token=" + token + "'>Click here</a>");
    Mail mail = new Mail(from, subject, to, content);
    SendGrid sg = new SendGrid(System.getenv("SENDGRID_API_KEY"));
    Request request = new Request();
    request.setMethod(Method.POST);
    request.setEndpoint("mail/send");
    request.setBody(mail.build());
    sg.api(request);
  }

  public void sendTeamInvite(String email, String orgName, String inviteLink) {
    // Similar format
  }

  public void sendDailyReminder(String email, String learnerName) {
    // Similar format
  }

  public void sendPaymentReceipt(String email, Order order) {
    // Similar format
  }
}
```

**Email Templates:**
1. Password reset
2. Team invite
3. Daily reminder
4. Payment receipt
5. Streak expiration warning
6. Weekly digest

**Deliverables:**
- ✅ EmailService.java with template methods
- ✅ Email templates (HTML)
- ✅ SendGrid/Mailgun configuration
- ✅ Queue system for async sending (optional)
- ✅ Email bounce/complaint handling

**Done When:** Password reset emails send and arrive

---

### Task 4: Form Validation Framework (2 hrs)
**Priority:** P0 - CRITICAL

**Client-Side Validation:**
```jsx
// useFormValidation.js
export function useFormValidation(initialValues, onSubmit) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const validate = (fieldName, value) => {
    const rules = {
      email: (v) => v.includes('@') ? null : 'Invalid email',
      password: (v) => v.length >= 8 ? null : 'Min 8 characters',
      firstName: (v) => v.trim().length > 0 ? null : 'Required',
      // ... more rules
    }
    return rules[fieldName]?.(value)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setValues(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({
      ...prev,
      [name]: touched[name] ? validate(name, value) : null
    }))
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    setErrors(prev => ({
      ...prev,
      [name]: validate(name, value)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Validate all fields
    const newErrors = {}
    Object.keys(values).forEach(key => {
      newErrors[key] = validate(key, values[key])
    })
    setErrors(newErrors)

    if (Object.values(newErrors).every(e => !e)) {
      await onSubmit(values)
    }
  }

  return { values, errors, touched, handleChange, handleBlur, handleSubmit }
}
```

**Validation Rules Library:**
```javascript
const validators = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  password: (v) => v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v),
  passwordMatch: (v, confirm) => v === confirm,
  firstName: (v) => v.trim().length > 0,
  lastName: (v) => v.trim().length > 0,
  domain: (v) => /^[a-z0-9-]+$/.test(v),
  positiveNumber: (v) => v > 0,
  // ... more
}
```

**Deliverables:**
- ✅ useFormValidation hook
- ✅ validators.js with 15+ rule sets
- ✅ FormError component
- ✅ Updated all forms with validation
- ✅ Error messages display

**Done When:** All forms validate client-side, errors display correctly

---

### Task 5: Error Boundaries & Error Handling (1.5 hrs)
**Priority:** P0 - CRITICAL

**React Error Boundary:**
```jsx
// ErrorBoundary.jsx
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to Sentry
    Sentry.captureException(error, { contexts: { react: errorInfo } })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-slate-600 mb-6">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Global Error Handler:**
```javascript
// setupErrorHandling.js
window.addEventListener('unhandledrejection', event => {
  Sentry.captureException(event.reason)
})

// API error interceptor
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login'
    }
    Sentry.captureException(error)
    throw error
  }
)
```

**Deliverables:**
- ✅ ErrorBoundary component
- ✅ Global error handler setup
- ✅ Sentry integration
- ✅ Error fallback pages (404, 500, etc.)

**Done When:** App crashes display error page, errors logged to Sentry

---

### Task 6: Environment Configuration (1 hr)
**Priority:** P0 - CRITICAL

**.env.example:**
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rebyu
DATABASE_POOL_SIZE=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=86400

# Cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxx

# PayMongo
PAYMONGO_SECRET_KEY=sk_test_xxxxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxxxx

# SendGrid
SENDGRID_API_KEY=SG.xxxxx

# S3
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_S3_BUCKET=rebyu-uploads

# Monitoring
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
DATADOG_API_KEY=xxxxx

# App
APP_ENV=development
APP_NAME=rebyu
APP_URL=http://localhost:3000
API_URL=http://localhost:8080

# Features
FEATURE_CHAT_ENABLED=false
FEATURE_ADVANCED_ANALYTICS_ENABLED=false
```

**Configuration Loader (Java):**
```java
@Configuration
public class AppConfig {
  @Value("${database.url}")
  private String databaseUrl;

  @Value("${jwt.secret}")
  private String jwtSecret;

  @Bean
  public DataSource dataSource() {
    // Create datasource from DATABASE_URL
  }

  @Bean
  public JwtProvider jwtProvider() {
    return new JwtProvider(jwtSecret);
  }
}
```

**Deliverables:**
- ✅ .env.example with all variables
- ✅ .env.development, .env.staging, .env.production templates
- ✅ Environment loader (Java + Node.js)
- ✅ Secrets validation on startup
- ✅ Documentation of all variables

**Done When:** App starts with .env file, all required vars present

---

### Task 7: Admin Pages - Users List & Details (2 hrs)
**Priority:** P1 - HIGH

**Pages to Build:**
1. **Admin Users List Page**
```jsx
export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  // Fetch, search, filter, paginate
  // Display: name, email, org, role, status, actions
}
```

2. **User Detail Page**
```jsx
export default function UserDetailPage() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [activity, setActivity] = useState([])

  // Show: profile, activity timeline, actions
  // Allow: change role, suspend, delete, impersonate
}
```

**Deliverables:**
- ✅ admin-users-page.jsx (list with search/filter)
- ✅ user-detail-page.jsx (profile + activity)
- ✅ Bulk action checkboxes
- ✅ User status badge component
- ✅ Activity timeline component

**Done When:** Admin can search users, view details, take actions

---

### Task 8: Organization Analytics Page (2 hrs)
**Priority:** P1 - HIGH

**Analytics to Display:**
- Learner count + growth
- Certification completion rate
- Assessment pass rate
- Engagement metrics (daily active users)
- Time-to-competency
- Export to CSV/PDF

**Deliverables:**
- ✅ organization-analytics-page.jsx
- ✅ Chart components (Recharts)
- ✅ Report generator service
- ✅ Export functionality
- ✅ Date range filtering

**Done When:** Admin can generate reports and export data

---

### Task 9: Integration Tests - Critical Paths (3 hrs)
**Priority:** P1 - HIGH

**Test Scenarios:**
1. User registration → login → dashboard
2. Assessment flow: start → answer → submit → view results
3. Profile update → password change
4. Organization creation → invite member → view team
5. Study plan generation → completion
6. Payment flow: checkout → webhook → subscription

**Tools:** JUnit 5 + Spring Boot Test + Testcontainers

**Deliverables:**
- ✅ UserAuthenticationIntegrationTest
- ✅ AssessmentIntegrationTest
- ✅ OrganizationIntegrationTest
- ✅ PaymentIntegrationTest
- ✅ Test database setup (Testcontainers)

**Done When:** All critical paths pass end-to-end tests

---

## Success Criteria

✅ Database fully migrated
✅ All 15 pages routable
✅ Email sending working
✅ Forms validate correctly
✅ Errors handled gracefully
✅ Environment variables loaded
✅ Admin pages operational
✅ Critical path tests passing
✅ App ready for staging deployment

---

## Timeline

**Day 1 (8 hrs):**
- Morning: Tasks 1-3 (DB, routing, email)
- Afternoon: Tasks 4-5 (validation, error handling)

**Day 2 (8 hrs):**
- Morning: Task 6-7 (env config, admin pages)
- Afternoon: Task 8 (analytics)

**Day 3 (4 hrs):**
- Task 9 (integration tests)
- Final verification + fixes

---

**PHASE 5 = Launch Blocker. Must complete before going live.**
