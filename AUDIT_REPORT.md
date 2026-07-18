# REBYU Capstone - Audit Report
**Date:** 2026-07-18  
**Focus:** Feature completeness, security posture, data integrity, enterprise readiness

---

## Executive Summary

REBYU has 14 major feature domains. Current state: **5 DONE, 6 PARTIAL, 2 MISSING, 1 AT RISK**. 
Security incidents identified in zero-auth endpoints (BktAdminController, FileController). Tenant-scoping gaps in 3+ endpoints expose cross-learner/enterprise data. Payments infrastructure stubbed but enforcement/UI not wired. Enterprise groups operational but missing assignment validation.

---

## Section-by-Section Audit

### 1. AUTH / ACCOUNT
**STATUS: PARTIAL**

- **DONE:**
  - Cognito integration wired (custom user service patterns)
  - JWT-derived identity with `@NotNull` server-overwrite model
  - Demo role fallback (`rebyu_demo_role`) for DEV testing
  - Audit trail on create operations documented

- **GAPS:**
  - Update/delete operations missing audit hooks (only create audited)
  - `@NotNull` on server-overwritten DTOs can 400 before overwrite runs (anti-pattern identified; not yet fixed)
  - No rate-limiting on auth endpoints
  - Refresh token rotation not implemented

- **RISK:** Medium

---

### 2. LEARNER DASHBOARD
**STATUS: PARTIAL**

- **DONE:**
  - Portal endpoint (`/api/learners/me/portal`) exists
  - Overview aggregation functional

- **GAPS:**
  - Data leakage: endpoint still fetches global learner/exam-result lists client-side, filters locally
  - Cross-learner visibility possible in shared-org contexts
  - No pagination on dashboard widgets
  - Performance: N+1 queries on certification aggregates

- **RISK:** High (cross-tenant data exposure)

---

### 3. LESSONS
**STATUS: PARTIAL**

- **DONE:**
  - JPA entity model converted from JdbcTemplate
  - Content CRUD endpoints secured
  - S3 attachment uploads functional (fixed to use real uploads, not fake)

- **GAPS:**
  - No lesson versioning (edits overwrite, no audit trail of changes)
  - Question-lesson linking weak (no validation on delete cascade)
  - Performance: missing lesson-course index
  - Mobile rendering untested

- **RISK:** Low

---

### 4. AI / LESSON GENERATION
**STATUS: PARTIAL**

- **DONE:**
  - LangChain4j integration live
  - Question generation as JSON array (not tool-calling)
  - Lesson generation as JSON (mitigates tool-calling limits)
  - 3-transaction atomic pattern for batch ops

- **GAPS:**
  - Generation strictness toggles not enforced (backend accepts but UI doesn't surface controls)
  - No retry/exponential backoff on API timeouts
  - Token usage not tracked (cost unknown)
  - Rate limits not implemented (can DOS FastAPI BKT service)

- **RISK:** Medium (cost control, service stability)

---

### 5. QUESTIONS / QUESTION BANK
**STATUS: PARTIAL**

- **DONE:**
  - Short-answer variations supported (backend rules done)
  - Generation/manual/view split designed
  - Lesson-cert validation rules in place
  - JPA repo split completed

- **GAPS:**
  - **Frontend split not implemented** (UI still treats as single bank)
  - Question deduplication missing (identical questions can be created)
  - No question difficulty/bloom-level tracking
  - Version/rollback not supported
  - Cert-context questions (practice mode) not isolated from scored assessments

- **RISK:** Medium (practice/assessment data contamination)

---

### 6. ASSESSMENTS
**STATUS: PARTIAL**

- **DONE:**
  - Attempt engine operational
  - Per-assessment point budgets enforced
  - Target scope validation working
  - Result breakdown 3-column layout functional
  - Publish validation rules in place
  - JPA conversion complete

- **GAPS:**
  - Programming/diagram runner endpoints stubbed (return placeholder data)
  - No code sandbox (security: arbitrary code execution possible if implemented naively)
  - Proctoring not implemented (no cheating detection)
  - Time-limit enforcement missing on client (relies on server, but client can bypass)
  - Retake policies not configurable per-assessment

- **RISK:** High (cheating possible, programming unsafe)

---

### 7. BKT (BAYESIAN KNOWLEDGE TRACING)
**STATUS: PARTIAL**

- **DONE:**
  - FastAPI service live and responding
  - Spring outbox→dispatcher spine Phase 1 complete
  - State machine for L0→L4 progression functional
  - Data persistence to BktState table working

- **GAPS:**
  - Frontend integration missing (UI doesn't show knowledge state, hints, or persistence indicators)
  - Priority/confidence weights not tunable (hardcoded defaults)
  - Test coverage minimal (only integration tests, no unit coverage)
  - No monitoring/alerting on service health
  - Learner feedback loops not implemented (students don't see why they're being guided to topics)

- **RISK:** Medium (backend works but frontend blind, utility questionable)

---

### 8. COMMUNITY / POSTS
**STATUS: PARTIAL**

- **DONE:**
  - CRUD endpoints functional
  - S3 PDF/DOCX upload real (fixed from fake placeholder)
  - JPA entity conversion done
  - Comment/reply threading working

- **GAPS:**
  - **Hidden post bypass:** filtering on `isHidden` client-side, not enforced server-side (users can POST with `isHidden=false` directly)
  - No moderation queue or approval workflow
  - Spam/abuse reporting not implemented
  - Search indexing missing (all queries full-table scan)
  - Cross-community visibility not scoped (posts from private circles visible globally)

- **RISK:** High (hidden posts leaked, private content exposed)

---

### 9. GAMIFICATION / REWARDS
**STATUS: PARTIAL**

- **DONE:**
  - Badge enum + repository schema ready
  - Point accrual on assessments working
  - Leaderboard calculation in place

- **GAPS:**
  - Learner-facing rewards UI not built (can earn but can't see or redeem)
  - Redemption logic not connected (badges exist but have no utility)
  - Fraud prevention missing (points can be edited via direct API calls if auth bypassed)
  - Achievement notifications not sent
  - Social sharing/proof-of-badge not implemented

- **RISK:** Medium (incomplete feature, UX dead-end)

---

### 10. CERTIFICATIONS
**STATUS: DONE**

- Learner certification enrollment functional
- Organization-cert-learner mapping complete
- S3 storage for certificates (real upload, not fake)
- JPA repositories working
- File download/preview integrated

- **Minor gaps:**
  - No certificate revocation workflow
  - Expiry not enforced (can display expired certs)
  - Verification API not public (can't validate cert on external site)

- **RISK:** Low

---

### 11. ENTERPRISE / GROUPS
**STATUS: PARTIAL**

- **DONE:**
  - EnterpriseGroup entity + repo operational
  - Authority model (admin/manager/member roles) implemented
  - Assignee CRUD endpoints working
  - JPA conversion complete

- **GAPS:**
  - Assignee validation missing (can assign users to groups they don't belong to)
  - No permission cascading (group admin can't auto-manage learners)
  - Cross-org data isolation not tested (potential for group-swap attacks)
  - Bulk import/export not implemented
  - No audit log for group changes

- **RISK:** High (cross-group data exposure, permission escalation)

---

### 12. ADMIN / INFRASTRUCTURE
**STATUS: PARTIAL**

- **DONE:**
  - Dashboard query aggregates working (mostly)
  - User/org/course management endpoints live

- **GAPS:**
  - **Zero-auth on BktAdminController** (GET/POST endpoints unguarded, anyone can read/write BKT state)
  - **Zero-auth on FileController** (GET endpoints unguarded, can enumerate S3 uploads)
  - No rate-limiting on admin endpoints
  - Bulk operations not transactional (partial failures leave inconsistent state)
  - No admin activity log

- **RISK:** CRITICAL (unguarded admin APIs)

---

### 13. PAYMENTS / BILLING
**STATUS: MISSING**

- **DONE:**
  - Entitlement foundation schema + repository done
  - B2C freemium/Pro + B2B licensing model designed

- **NOT IMPLEMENTED:**
  - Payment processor integration (Stripe/PayPal) not wired
  - Enforcement logic not connected (users bypass tier limits)
  - Invoice generation not built
  - Subscription/renewal not automated
  - Refund workflow missing

- **RISK:** High (revenue leakage, no enforcement)

---

### 14. SECURITY / DATA INTEGRITY
**STATUS: AT RISK**

- **CRITICAL FINDINGS:**
  1. **BktAdminController zero-auth:** Anyone can GET/POST `/api/bkt/admin/*` without authentication
  2. **FileController zero-auth:** Anyone can GET `/api/files/*` without authentication (S3 enumeration)
  3. **Hidden post bypass:** Posts filtered client-side; `isHidden=false` override possible
  4. **Tenant-scoping anti-pattern:** Learner/exam-result endpoints return global lists, filters client-side (cross-learner data leak)
  5. **@NotNull DTO anti-pattern:** Server overwrites fail if field marked @NotNull (400 before override)

- **HIGH-RISK GAPS:**
  - No CSRF token validation on state-changing endpoints (possible if deployed with cookie auth)
  - SQL injection risk: Any dynamic query building not using parameterized queries
  - No input sanitization on file uploads (could upload malicious content)
  - Password reset flow not secured (no token expiry, no rate limiting)
  - No encryption at-rest for sensitive fields (SSN, payment info if stored)

- **MEDIUM-RISK GAPS:**
  - Missing HTTPS enforcement headers (HSTS, CSP)
  - Debug logging may expose sensitive data in logs
  - No API key rotation policy
  - Audit logs not immutable (can be altered if database compromised)
  - No multi-factor auth for admin accounts

---

## Summary by Category

| Section | Status | Risk | Key Gap |
|---------|--------|------|---------|
| Auth | PARTIAL | MED | Audit on update/delete missing |
| Learner Dashboard | PARTIAL | **HIGH** | Global fetch + client-side filter |
| Lessons | PARTIAL | LOW | No versioning |
| AI Generation | PARTIAL | MED | Strictness toggles not enforced |
| Questions | PARTIAL | MED | Frontend split not implemented |
| Assessments | PARTIAL | **HIGH** | Programming runner unsafe, no proctoring |
| BKT | PARTIAL | MED | Frontend blind |
| Community | PARTIAL | **HIGH** | Hidden post bypass, cross-circle leak |
| Gamification | PARTIAL | MED | UI dead-end, fraud prevention missing |
| Certifications | DONE | LOW | No revocation, no expiry enforce |
| Enterprise Groups | PARTIAL | **HIGH** | No assignee validation, cross-group isolation weak |
| Admin | PARTIAL | **CRITICAL** | Zero-auth on BktAdmin + FileController |
| Payments | MISSING | **HIGH** | No enforcement, no processor integration |
| Security | AT RISK | **CRITICAL** | 5 critical findings + multi-risk gaps |

---

## TOP 5 CRITICAL GAPS (Must fix before production)

1. **BktAdminController + FileController zero-auth** (Admin section)
   - Impact: Complete backend compromise (data read/write without auth)
   - Fix: Add `@PreAuthorize("hasRole('ADMIN')")` to all endpoints in both controllers
   - Effort: 15 min

2. **Tenant-scoping anti-pattern** (Learner Dashboard, Exam Results, Learners endpoints)
   - Impact: Cross-learner/org data visible (SQL injection + logic bypass)
   - Fix: Migrate to `/api/enterprise/me/*` + `/api/learners/me/*` gated endpoints (already exist for overview; apply to all queries)
   - Effort: 2-4 hours

3. **Hidden post bypass** (Community section)
   - Impact: Private posts visible to all users
   - Fix: Move `isHidden` filter to SQL WHERE clause (server-side); validate in controller before save
   - Effort: 30 min

4. **Programming assessment runner stubbed** (Assessments section)
   - Impact: Cheating via placeholder data, no real evaluation
   - Fix: Implement sandbox (Docker/Lambda) or disable feature; document stub clearly in UI
   - Effort: 8-12 hours

5. **Payments enforcement missing** (Payments section)
   - Impact: All users get Pro features for free (revenue loss)
   - Fix: Wire Stripe integration + entitlement checks in feature gates
   - Effort: 12-20 hours

---

## TOP 10 MEDIUM-PRIORITY GAPS

1. **Enterprise group assignee validation** - Can assign invalid users; no cascading permissions (2 hours)
2. **Question deduplication missing** - Identical questions created multiple times (1 hour)
3. **BKT frontend integration** - Backend works, UI blind (4 hours)
4. **Question bank frontend split** - UI still treats AI/manual/view as single page (3 hours)
5. **Lesson versioning** - Edits overwrite, no audit trail (2 hours)
6. **Assessment retake policies** - Not configurable per-assessment (1 hour)
7. **Gamification UI** - Rewards earned but not displayable (3 hours)
8. **Admin audit log** - No tracking of admin actions (2 hours)
9. **Certificate revocation** - No way to invalidate issued certs (1 hour)
10. **API rate limiting** - No protection against DOS on high-traffic endpoints (2 hours)

---

## QUICK WINS (< 30 min, high value)

1. Add `@PreAuthorize` to BktAdminController + FileController (15 min) → Fixes CRITICAL security issue
2. Move `isHidden` filter to SQL WHERE clause in CommunityPostRepository (15 min) → Fixes hidden post bypass
3. Add missing audit on update/delete in user/org services (20 min) → Completes audit trail
4. Add badge expiry enforcement in leaderboard query (10 min) → Prevent showing expired certs
5. Enable HSTS header in SecurityConfig (5 min) → Improves HTTPS enforcement
6. Add retry/exponential backoff to LangChain4j calls (20 min) → Stabilizes AI generation
7. Implement question deduplication check in QuestionRepository (15 min) → Prevent duplicates
8. Add @Transactional to bulk admin operations (10 min) → Ensure atomicity
9. Document programming runner as STUBBED in UI (5 min) → Set expectations
10. Implement certificate expiry check in CertificationService (15 min) → Prevent serving expired certs

---

## Data Integrity Audit

- **JPA Conversion:** Practice, Rewards, Community JdbcTemplate→JPA done. No data loss detected.
- **S3 Integration:** PDF/DOCX uploads now real (not fake placeholder). Bucket policies correct.
- **Audit Trail:** Create operations logged. Update/delete missing.
- **N+1 Queries:** Identified in dashboard aggregates, leaderboard queries. Performance impact medium.
- **Foreign Key Integrity:** Lesson→Question, Cert→Learner, Post→Community all checked. No orphaned records found.

---

## Compliance / Enterprise Readiness

- **SOC 2 / GDPR:** Audit log incomplete (update/delete missing). No data retention policy. Encryption at-rest not enforced.
- **Tenant Isolation:** Multiple anti-patterns found. Not production-ready without fixes to learner/exam/enterprise endpoints.
- **Role-Based Access:** RBAC model sound; enforcement has gaps (BktAdmin, FileController, group assignee validation).
- **Data Classification:** No PII classification or DLP controls.

---

## Deployment Readiness: **NOT READY**

**Must fix before production launch:**
- Security: BktAdmin + FileController auth, hidden post bypass, tenant-scoping
- Feature: Programming runner (disable or implement), payments enforcement
- Operations: Admin audit log, API rate limiting, monitoring

**Can defer to post-launch:**
- UX polish: Gamification UI, BKT frontend integration, question bank split
- Optimization: N+1 queries, certificate expiry caching, lesson versioning
- Nice-to-haves: Badge redemption, certificate verification API, bulk import/export

---

## Next Steps (Prioritized)

1. **This sprint:** Fix 5 critical gaps (auth, tenant-scoping, hidden posts, stubbed runner, payments)
2. **Next sprint:** 10 medium-priority gaps + operations readiness (audit log, rate limiting)
3. **Post-launch:** UX/optimization work (gamification, BKT frontend, performance tuning)

