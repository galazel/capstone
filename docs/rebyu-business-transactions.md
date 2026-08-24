# REBYU — Multi-Table Business Transactions

Every business operation that writes to **more than one table in a single database
commit**, so that a failure partway through cannot leave the database inconsistent.

Each entry corresponds to a real `@Transactional` boundary in the Spring Boot service
layer. Write sets include the repositories reachable inside that boundary, including
those in services it calls into — Spring propagates the caller's transaction by default,
so a nested service participates in the same commit rather than opening its own.

**Scope.** Read-only operations, single-table CRUD and admin configuration writes are
excluded. Counts are tables *written*; tables read for validation are not counted.

---

## Summary

| # | Transaction | Domain | Tables | Status |
|---|---|---|---|---|
| T1 | Submit an assessment attempt | Assessment | 10 | Working |
| T2 | Start an assessment attempt | Assessment | 2 | Working |
| T3 | Run / check a programming or diagram answer | Assessment | 2 | Working |
| T4 | Purchase a certification | Enrollment | 2 | Working (simulated payment) |
| T5 | Confirm payment and grant access | Enrollment | 3 | Working (simulated payment) |
| T6 | Apply a payment-provider webhook | Billing | 2 | Endpoint live, provider not verified |
| T7 | Invite a learner to an organization | Enterprise | 4 | Working |
| T8 | Accept an enterprise invitation | Enterprise | 5 | Working |
| T9 | Submit a partnership request | Partnerships | 4 | Working |
| T10 | Persist an AI-generated certification | Generation | 11 | Working (phased, not atomic) |
| T11 | Complete a practice attempt | Practice | 4 | Working |
| T12 | Award XP, coins or AI credits | Rewards | 2 | Working |
| T13 | Share a study item to the community | Community | 3 | Working |
| T14 | Dispatch mastery events to the BKT service | Integration | 1 + HTTP | Working |

**14 multi-table transactions · 38 distinct tables written · largest single commit: 10 tables**

---

## Assessment

### T1 — Submit an assessment attempt
`AssessmentAttemptService.submitAttempt` — **10 tables**

The system's largest transaction. Grading an attempt closes the attempt, scores every
answer, records the result, pays out XP and coins, evaluates achievements, extends the
learner's streak, and enqueues a mastery event for the analytics service. A failure at
any point rolls the whole thing back, so a learner can never be paid XP for an attempt
that was not recorded.

**Writes:** `assessment_attempts`, `assessment_attempt_answers`,
`assessment_attempt_questions`, `exam_results`, `learner_reward_ledger`,
`learner_reward_balances`, `learner_achievements`, `streak`, `bkt_event_outbox`,
`learner_certifications`

**Guarantees:** idempotent re-submit (a second submit returns the existing result);
transactional outbox for the external event; AI grading retried before the answer is
closed out.

### T2 — Start an assessment attempt
`AssessmentAttemptService.startAttempt` — **2 tables**

Opens an attempt and copies each selected question into it. The copy is the point: the
attempt stores its own `question_text_snapshot`, so an admin editing a question afterwards
cannot retroactively change a paper someone has already sat.

**Writes:** `assessment_attempts`, `assessment_attempt_questions`

### T3 — Run or check a programming / diagram answer
`AssessmentAttemptService.runProgramming` · `checkDiagram` — **2 tables**

Programming answers run through Judge0 against each test case; diagram answers are parsed
into a structural graph and matched against the admin's reference. Both are deterministic
(non-AI) graders. The run is recorded so execution history survives independently of the
final grade.

**Writes:** `assessment_attempt_executions`, `assessment_attempt_answers`

---

## Enrollment and billing

### T4 — Purchase a certification
`EnrollmentTransactionService.purchase` — **2 tables**

Creates the order and its line item together. Carries a client-supplied idempotency key
under a unique constraint, so a double-clicked checkout or a retried request returns the
original order instead of creating a second one.

**Writes:** `learner_orders`, `learner_order_details`

### T5 — Confirm payment and grant access
`EnrollmentTransactionService.confirmPayment` — **3 tables**

Marks the order paid, creates the enrollment that unlocks the curriculum, and evaluates
any achievement the purchase earns. Payment status and access are decided in one commit,
so an order can never read as paid while the learner remains locked out.

**Writes:** `learner_orders`, `learner_certifications`, `learner_achievements`

> **Status note.** The frontend's claim that a payment succeeded is never trusted —
> verification goes through the `PaymentVerificationService` interface. The only
> implementation currently registered is `DevSimulatedPaymentVerifier`, which accepts a
> reference of the form `SIM-<orderNumber>` and reports its provider as `DEV_SIMULATED`.
> The transaction is complete and correct; the provider behind it is simulated.

### T6 — Apply a payment-provider webhook
`PaymentWebhookService`, via `POST /api/webhooks/paymongo` — **2 tables**

Reconciles a PayMongo callback against the subscription plan and updates the learner's
subscription. Webhooks are re-delivered by design, so the handler is written to be safely
repeatable.

**Writes:** `learner_subscriptions`, `subscription_plans`

> **Status note.** The endpoint and handler exist and are wired. Signature verification
> against PayMongo is not yet in place, so this should be treated as not production-ready.

---

## Enterprise and partnerships

### T7 — Invite a learner to an organization
`EnterpriseInvitationService` — **4 tables**

Validates the seat allocation, records the invitation against a certificate and group, and
notifies the recipient. The token is generated inside the transaction so an invitation can
never reference a row that was rolled back.

**Writes:** `learner_invitations`, `notifications`, `enterprise_group_authorities`, `users`

> **Known gap.** The email is sent outside the database transaction. A commit that fails
> after the send would leave a delivered email referencing no invitation.

### T8 — Accept an enterprise invitation
`LearnerService.acceptInvitation` — **5 tables**

The moment a person becomes a sponsored learner. Consumes the single-use token, provisions
or links the learner, allocates them against the organization's certificate, assigns them
to their group, and notifies the group's leader — all or nothing.

**Writes:** `learner_invitations`, `learners`, `organization_certification_learners`,
`enterprise_group_assignees`, `notifications`

**Guarantees:** single-use token, expiry checked inside the transaction.

### T9 — Submit a partnership request
`PartnershipRequestTransactionService` — **4 tables**

An organization requests a set of certifications. The request header and one line per
certification are written together, so a request can never exist with no items or with a
partial selection.

**Writes:** `partnership_requests`, `partnership_request_items`, `enterprises`,
`notifications`

---

## Content generation

### T10 — Persist an AI-generated certification
`assessment_persistence.persist_generated_assessments` (FastAPI) ·
`CurriculumGenerationService` (Spring) — **11 tables**

The widest write in the system, and deliberately **not** a single transaction. A generation
run takes tens of minutes across two services; holding one transaction open for that long
would pin a database connection and lock rows the admin portal needs. The run is split into
phases that each commit, with a LangGraph checkpoint after every step, so a failure resumes
from the last completed phase instead of regenerating from scratch.

**Writes:** `certifications`, `major_categories`, `middle_categories`, `lessons`,
`questions`, `choices`, `text_question_configs`, `exams`, `exam_questions`,
`generation_requests`, `checkpoints`

> **Known gap.** Not atomic end to end. A run that fails mid-phase leaves earlier phases
> committed, and the certification is left marked as generating until the run finishes or
> is explicitly failed.

---

## Practice, rewards and community

### T11 — Complete a practice attempt
`StudyPracticeService.completeAttempt` — **4 tables**

Scores a generated study set, closes the attempt and pays the reward. Practice is
deliberately excluded from the learner's assessment score figures elsewhere in the system —
it is unproctored and retakeable, so counting it would inflate what a group leader reads.

**Writes:** `learner_practice_attempts`, `learner_practice_answers`,
`generated_study_sets`, `learner_reward_ledger`

### T12 — Award XP, coins or AI credits
`RewardService.awardXp` · `convertCoinsToAiCredits` — **2 tables**

Every reward writes an immutable ledger entry and updates the running balance in the same
commit, so the balance is always reconcilable against the ledger. The insert is conditional
on an idempotency key and the balance only moves when the ledger row was actually created —
a replayed award is a no-op rather than a double payment.

**Writes:** `learner_reward_ledger`, `learner_reward_balances`

### T13 — Share a study item to the community
`CommunityService.shareStudyItem` — **3 tables**

Publishes a learner's own library item as a post inside a circle, linking the post back to
the source item so the original owner stays attributable.

**Writes:** `community_posts`, `learner_library_items`, `community_circle_members`

---

## Cross-service integration

### T14 — Dispatch mastery events to the BKT service
`BktEventDispatcher` · `BktOutboxService.claimBatch` — **1 table + HTTP**

The consumer half of the outbox written by T1. A scheduled worker claims a batch of pending
events, calls the FastAPI knowledge-tracing service, and marks them processed, retried with
backoff, or dead-lettered. Claims use `FOR UPDATE SKIP LOCKED`, so two application
instances never dispatch the same event.

**Writes:** `bkt_event_outbox` (+ HTTP to the FastAPI BKT service)

**Guarantees:** skip-locked claim, exponential backoff, dead-letter queue after a retry
ceiling.

---

## Recurring patterns

Three techniques recur across the transactions above. Each exists because of a specific
failure the naive version allows.

**Transactional outbox** — *T1 → T14.* Submitting an attempt must also tell an external
service about it. Calling that service inside the transaction would either roll back a
successful HTTP call or commit an attempt whose event was lost. The event is instead written
to `bkt_event_outbox` in the same commit and delivered by a separate worker, so the event
exists if and only if the attempt does.

**Idempotency keys** — *T4, T6, T12.* Retries, double clicks and re-delivered webhooks all
replay a request that already succeeded. Orders and reward-ledger entries carry a key under
a unique constraint, so the second attempt returns the first result instead of creating a
duplicate order or paying XP twice.

**Snapshot-on-write** — *T2.* An attempt copies each question's text into
`assessment_attempt_questions` rather than referencing it. Editing or deleting a question
later cannot alter or erase a paper a learner has already sat, which keeps historical
results defensible.

---

## Open items

| Item | Affects | Nature |
|---|---|---|
| Real payment provider not wired | T4, T5 | Only `DEV_SIMULATED` verifier is registered |
| Webhook signature not verified | T6 | Endpoint accepts unauthenticated callbacks |
| Email sent outside the commit | T7 | Email can outlive a rolled-back invitation |
| Generation not atomic end to end | T10 | Deliberate; failure leaves earlier phases committed |
