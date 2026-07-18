# Python BKT (Bayesian Knowledge Tracing) Service - Complete Implementation

## 🏗️ Architecture Overview

The Python BKT service is a **FastAPI microservice** that uses **PyBKT** to calculate learner mastery/confidence scores. It receives assessment events from the Java backend and computes Bayesian Knowledge Tracing updates in real-time.

**Service Purpose:**
- Receive mastery events from Java backend
- Calculate knowledge probability (pKnow) for each learner-lesson pair
- Derive mastery levels (weak/developing/good/mastered)
- Compute lesson priorities (critical/high/medium/low)
- Provide mastery queries via REST API

---

## 📦 Project Structure

```
python-backend/
├── app/
│   ├── main.py                      # FastAPI app entry point
│   ├── api/
│   │   ├── router.py               # API router aggregation
│   │   └── routes/
│   │       ├── mastery.py          # POST events, GET mastery
│   │       ├── priorities.py       # GET lesson/category priorities
│   │       ├── parameters.py       # BKT parameters management
│   │       ├── training.py         # PyBKT model training
│   │       ├── analytics.py        # Analytics endpoints
│   │       └── health.py           # Health checks
│   ├── services/
│   │   ├── mastery_service.py      # Event processing logic
│   │   ├── bkt_math.py             # Bayesian update formulas
│   │   ├── parameter_service.py    # Parameter resolution
│   │   ├── priority_service.py     # Priority calculation
│   │   ├── category_service.py     # Category aggregation
│   │   └── confidence_service.py   # Confidence computation
│   ├── repositories/
│   │   ├── bkt.py                  # Database queries
│   │   └── training.py             # Training data access
│   ├── db/
│   │   ├── models.py               # SQLAlchemy ORM models
│   │   ├── session.py              # DB session management
│   │   └── base.py                 # Base class
│   ├── schemas/
│   │   ├── mastery.py              # Event DTOs
│   │   ├── priority.py             # Priority DTOs
│   │   └── analytics.py            # Analytics DTOs
│   └── core/
│       ├── config.py               # Settings
│       └── security.py             # Service key auth
├── alembic/
│   └── versions/                   # DB migrations
└── tests/
    └── test_bkt_math.py            # BKT formula tests
```

---

## 🧮 Core: BKT Math (bkt_math.py)

The heart of the system—Bayesian Knowledge Tracing formula implementation.

### Key Formula: `update_mastery()`

```python
def update_mastery(
    *,
    mastery_before: float,      # Prior probability of knowledge
    is_correct: bool,           # Observed answer (correct or incorrect)
    learn: float,               # Probability of learning per exposure
    guess: float,               # Probability of guessing correctly
    slip: float,                # Probability of careless error
    forget: float = 0.0,        # Probability of forgetting (optional)
) -> BktUpdateResult:
```

### The Algorithm

**1. Predict probability of correct answer (before observing):**
```
P(correct) = P(knowledge) × (1 - slip) + (1 - P(knowledge)) × guess
```
Example:
- If learner has 60% mastery, slip is 5%, guess is 20%
- P(correct) = 0.6 × 0.95 + 0.4 × 0.2 = 0.57 + 0.08 = 0.65 (65%)

**2. Update belief using Bayes' theorem (likelihood ratio):**

If **answer is CORRECT:**
```
numerator = P(knowledge) × (1 - slip)        # P(correct | knows)
denominator = P(knowledge) × (1 - slip) + (1 - P(knowledge)) × guess
posterior = numerator / denominator
```

If **answer is INCORRECT:**
```
numerator = P(knowledge) × slip              # P(incorrect | knows)
denominator = P(knowledge) × slip + (1 - P(knowledge)) × (1 - guess)
posterior = numerator / denominator
```

**3. Apply learning transition (learn if don't know, forget if know):**
```
mastery_after = posterior × (1 - forget) + (1 - posterior) × learn
```

### Example Calculation

**Scenario:** Student attempts a medium-difficulty question in "Variables & Data Types"

**Input:**
- Prior mastery: 0.5 (50% knowledge)
- Observed: **CORRECT**
- Parameters: learn=0.1, guess=0.2, slip=0.05, forget=0.0

**Step 1 - Predict:**
```
P(correct) = 0.5 × 0.95 + 0.5 × 0.2 = 0.475 + 0.1 = 0.575
```

**Step 2 - Update (correct observed):**
```
numerator = 0.5 × 0.95 = 0.475
denominator = 0.475 + 0.5 × 0.2 = 0.475 + 0.1 = 0.575
posterior = 0.475 / 0.575 ≈ 0.826 (82.6% after seeing the answer)
```

**Step 3 - Learning transition:**
```
mastery_after = 0.826 × 1.0 + 0.174 × 0.1 = 0.826 + 0.0174 ≈ 0.844
```

**Result:**
- mastery_before: 0.50 (50%)
- mastery_posterior: 0.826 (82.6%) — belief after seeing correct answer
- mastery_after: 0.844 (84.4%) — final state with learning
- predicted_correct_probability: 0.575 (57.5%)

---

## 📊 Mastery Levels

```python
def mastery_level(
    probability: float,
    *,
    developing_threshold: float,    # Default: 0.3
    good_threshold: float,          # Default: 0.6
    mastered_threshold: float,      # Default: 0.8
) -> str:
```

**Levels (configurable via thresholds):**
| Level | Range | Label | Interpretation |
|-------|-------|-------|-----------------|
| `weak` | < 30% | ⚠️ Not Started | Student is guessing |
| `developing` | 30-60% | 🔄 Learning | Student is making progress |
| `good` | 60-80% | ✓ Competent | Student understands material |
| `mastered` | 80%+ | ⭐ Mastered | Student has solid knowledge |

---

## 🔄 Event Processing Flow (mastery_service.py)

When Java backend sends an assessment answer, this is what happens:

### Step 1: Idempotency Check
```python
# Check if this event already processed (by source_event_id)
existing_event = db.query(BktMasteryEvent)
    .filter(BktMasteryEvent.source_event_id == payload.source_event_id)
    .first()

if existing_event:
    return existing_response  # Duplicate — return immediately
```

### Step 2: Resolve BKT Parameters
```python
# Get lesson-specific parameters (trained via PyBKT)
parameters = resolve_parameters(
    session,
    lesson_id=payload.lesson_id,          # Lesson being assessed
    difficulty_level=payload.difficulty_level,  # EASY/MEDIUM/HARD
    assessment_type=payload.assessment_type,    # QUIZ/DIAGNOSTIC/MOCK_EXAM
)

# Falls back to: per-difficulty → per-lesson → global defaults
```

Parameters include:
- `prior`: Initial knowledge probability (typically 0.2-0.5)
- `learn`: Learning rate per exposure (typically 0.05-0.2)
- `guess`: Probability of guessing correct (typically 0.1-0.4)
- `slip`: Probability of careless error (typically 0.01-0.1)
- `forget`: Forgetting rate over time (typically 0.0-0.05)

### Step 3: Get or Create Mastery Record
```python
mastery = db.query(LearnerLessonMastery)
    .where(learner_id == payload.learner_id, lesson_id == payload.lesson_id)
    .with_for_update()  # Lock for concurrent updates
    .first()

mastery_before = mastery.mastery_probability if mastery else parameters.prior
```

### Step 4: Calculate Bayesian Update
```python
update = update_mastery(
    mastery_before=mastery_before,
    is_correct=payload.is_correct,
    learn=parameters.learn,
    guess=parameters.guess,
    slip=parameters.slip,
    forget=parameters.forget,
)

# Returns: predicted_correct_probability, mastery_before, 
#          mastery_posterior, mastery_after
```

### Step 5: Determine Mastery Level
```python
level = mastery_level(
    update.mastery_after,
    developing_threshold=settings.developing_threshold,
    good_threshold=settings.good_threshold,
    mastered_threshold=settings.mastered_threshold,
)
# Returns: "weak", "developing", "good", or "mastered"
```

### Step 6: Update or Create Mastery Row
```python
if mastery is None:
    mastery = LearnerLessonMastery(
        learner_id=payload.learner_id,
        lesson_id=payload.lesson_id,
        mastery_probability=update.mastery_after,
        mastery_level=level,
        attempt_count=1,
        correct_count=1 if payload.is_correct else 0,
    )
else:
    mastery.mastery_probability = update.mastery_after
    mastery.mastery_level = level
    mastery.attempt_count += 1
    if payload.is_correct:
        mastery.correct_count += 1
```

### Step 7: Record Event (Audit Trail)
```python
event = BktMasteryEvent(
    source_event_id=payload.source_event_id,
    learner_id=payload.learner_id,
    lesson_id=payload.lesson_id,
    question_id=payload.question_id,
    is_correct=payload.is_correct,
    mastery_before=update.mastery_before,
    mastery_posterior=update.mastery_posterior,
    mastery_after=update.mastery_after,
    predicted_correct_probability=update.predicted_correct_probability,
    parameters_used=parameters.as_dict(),  # JSON snapshot
    occurred_at=payload.occurred_at,
    processed_at=datetime.now(timezone.utc),
)
session.add(event)
```

### Step 8: Compute Lesson Priorities
```python
# Calculate lesson priority (effort vs. mastery trade-off)
# Factors: mastery level, attempt count, recent performance
computed = priority_service.compute_lesson_priority(mastery, settings)

# Aggregate up: lesson → middle category → major category
priority_service.upsert_priority(session, ...)
category_service.recompute_categories(session, ...)
```

### Step 9: Commit (All or Nothing)
```python
session.commit()  # All inserts happen together
# If duplicate detected: rollback, fetch existing, return
```

---

## 📡 REST API Endpoints

### 1. **Ingest Single Event**
```http
POST /mastery/events
Authorization: X-API-Key: <service_key>
Content-Type: application/json

{
  "source_event_id": "attempt-123:question-456",
  "learner_id": 1,
  "lesson_id": 42,
  "question_id": 789,
  "is_correct": true,
  "difficulty_level": "MEDIUM",
  "assessment_type": "QUIZ",
  "occurred_at": "2026-07-18T21:15:30Z",
  "certification_id": 5,
  "middle_category_id": 3,
  "major_category_id": 1,
  "lesson_title": "Variables and Data Types"
}

Response (201):
{
  "source_event_id": "attempt-123:question-456",
  "duplicate": false,
  "mastery_before": 0.50,
  "mastery_posterior": 0.826,
  "mastery_after": 0.844,
  "mastery_level": "good",
  "attempt_count": 5,
  "predicted_correct_probability": 0.575,
  "parameters_used": {
    "prior": 0.2,
    "learn": 0.1,
    "guess": 0.2,
    "slip": 0.05,
    "forget": 0.0,
    "model_variant": "default"
  }
}
```

### 2. **Ingest Batch Events** (Most Common)
```http
POST /mastery/events/batch
Authorization: X-API-Key: <service_key>

{
  "events": [
    { /* event 1 */ },
    { /* event 2 */ },
    ...
  ]
}

Response (200):
[ /* array of responses */ ]
```

### 3. **Get Learner Mastery**
```http
GET /mastery/learners/1
GET /mastery/learners/1?lesson_id=42&lesson_id=43

Response (200):
{
  "items": [
    {
      "lesson_id": 42,
      "lesson_title": "Variables",
      "mastery_probability": 0.844,
      "mastery_level": "good",
      "attempt_count": 5,
      "correct_count": 4
    },
    ...
  ],
  "total": 15,
  "average_mastery_probability": 0.657
}
```

### 4. **Get Lesson Priorities** (Study Recommendations)
```http
GET /priorities/learners/1/certifications/5/lessons

Response (200):
[
  {
    "lesson_id": 42,
    "lesson_title": "Variables & Data Types",
    "mastery_probability": 0.55,
    "mastery_level": "developing",
    "priority_score": 0.78,
    "priority_tag": "CRITICAL",
    "priority_label": "🔴 Critical — Focus Here",
    "primary_reason": "Low mastery + recent assessment",
    "recommended_action": "Review lesson, then attempt quiz",
    "recommended_activity": "INTERACTIVE_LESSON"
  },
  ...
]
```

### 5. **Get Confidence (Certification Level)**
```http
GET /priorities/learners/1/certifications/5/confidence

Response (200):
{
  "learner_id": 1,
  "certification_id": 5,
  "overall_confidence": 0.675,
  "overall_mastery_level": "good",
  "lessons_mastered": 8,
  "lessons_good": 5,
  "lessons_developing": 6,
  "lessons_weak": 1,
  "total_lessons": 20,
  "total_assessments": 47,
  "ready_for_certification": false
}
```

---

## 💾 Database Models

### `bkt_mastery_events` — Event Audit Trail
```sql
CREATE TABLE bkt_mastery_events (
  event_id VARCHAR(36) PRIMARY KEY,
  source_event_id VARCHAR(150) UNIQUE NOT NULL,  -- Deduplication key
  learner_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  question_id BIGINT,
  is_correct BOOLEAN NOT NULL,
  difficulty_level VARCHAR(20),
  assessment_type VARCHAR(30),
  mastery_before FLOAT,              -- Before this event
  mastery_posterior FLOAT,           -- After observing answer
  mastery_after FLOAT,               -- After learning transition
  predicted_correct_probability FLOAT,
  parameters_used JSON,              -- Snapshot of parameters
  occurred_at TIMESTAMP,
  processed_at TIMESTAMP
);
```

### `learner_lesson_mastery` — Current State
```sql
CREATE TABLE learner_lesson_mastery (
  learner_id BIGINT PRIMARY KEY,
  lesson_id BIGINT PRIMARY KEY,
  mastery_probability FLOAT NOT NULL,    -- Current pKnow
  mastery_level VARCHAR(20),             -- weak/developing/good/mastered
  attempt_count INT,
  correct_count INT,
  incorrect_count INT,
  certification_id BIGINT,
  lesson_title VARCHAR(200),
  major_category_title, middle_category_title VARCHAR(200),
  last_assessment_type VARCHAR(30),
  last_event_id VARCHAR(150),
  last_updated TIMESTAMP
);
```

### `learner_lesson_mastery_history` — Timeline
```sql
CREATE TABLE learner_lesson_mastery_history (
  mastery_history_id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(150),
  learner_id BIGINT,
  lesson_id BIGINT,
  previous_mastery FLOAT,
  observation_posterior FLOAT,
  final_mastery FLOAT,
  previous_mastery_level VARCHAR(20),
  new_mastery_level VARCHAR(20),
  assessment_type VARCHAR(30),
  difficulty_level VARCHAR(20),
  created_at TIMESTAMP
);
```

### `learner_category_priorities` — Study Recommendations
```sql
CREATE TABLE learner_category_priorities (
  learner_category_priority_id VARCHAR(36) PRIMARY KEY,
  learner_id BIGINT,
  certification_id BIGINT,
  category_type VARCHAR(10),    -- LESSON/MIDDLE/MAJOR
  category_key VARCHAR(40),     -- LESSON:42
  lesson_id/middle_category_id/major_category_id BIGINT,
  mastery_probability FLOAT,
  mastery_level VARCHAR(20),
  priority_score FLOAT,
  priority_tag VARCHAR(30),     -- CRITICAL/HIGH/MEDIUM/LOW/ON_TRACK
  priority_label VARCHAR(50),   -- 🔴 Critical — Focus Here
  primary_reason TEXT,
  recommended_action TEXT,
  recommended_activity VARCHAR(40),  -- INTERACTIVE_LESSON, QUIZ, etc.
  evidence_count INT,
  updated_at TIMESTAMP
);
```

---

## 🎯 Priority Scoring Algorithm

Priorities balance **mastery need** and **effort**:

```python
priority_score = (
    0.4 * (1 - mastery_probability)  # 40% weight on gaps
    + 0.3 * (1 - proficiency_trend)  # 30% weight on recent decline
    + 0.2 * recent_error_rate        # 20% weight on recent mistakes
    + 0.1 * prerequisite_dependency  # 10% weight on prerequisites
)

# Map score to tags:
if priority_score >= 0.8: "CRITICAL"
elif priority_score >= 0.6: "HIGH"
elif priority_score >= 0.4: "MEDIUM"
elif priority_score >= 0.2: "LOW"
elif mastery >= 0.8: "STRONG"
elif too_new: "NOT_ENOUGH_DATA"
elif stale: "NEEDS_REASSESSMENT"
```

---

## 🚀 Request/Response Flow Example

### Java Backend Sends:
```json
{
  "source_event_id": "attempt-999:question-555",
  "learner_id": 42,
  "certification_id": 5,
  "lesson_id": 10,
  "lesson_title": "Loops",
  "question_id": 555,
  "is_correct": false,        // Student got it wrong
  "difficulty_level": "HARD",
  "assessment_type": "QUIZ",
  "major_category_id": 1,
  "middle_category_id": 2,
  "occurred_at": "2026-07-18T22:30:15Z"
}
```

### Python Service Processes:
1. Check: Not in `bkt_mastery_events` → new event ✓
2. Resolve parameters for lesson_id=10, difficulty=HARD, assessment=QUIZ
   - Found: prior=0.3, learn=0.1, guess=0.25, slip=0.08
3. Get learner_lesson_mastery(42, 10) → mastery_before=0.65
4. Calculate update (answer incorrect):
   - predicted: P(correct) = 0.65 × 0.92 + 0.35 × 0.25 = 0.686
   - posterior: 0.65 × 0.08 / (0.65 × 0.08 + 0.35 × 0.75) = 0.197
   - mastery_after: 0.197 + (1 - 0.197) × 0.1 = 0.276
5. New level: 0.276 → "developing" (between 0.3 and 0.6)
6. Save event + history + update mastery row
7. Recalculate priorities (now marked as CRITICAL)

### Response to Java:
```json
{
  "source_event_id": "attempt-999:question-555",
  "duplicate": false,
  "mastery_before": 0.65,
  "mastery_posterior": 0.197,
  "mastery_after": 0.276,
  "mastery_level": "developing",
  "attempt_count": 8,
  "predicted_correct_probability": 0.686,
  "parameters_used": {
    "prior": 0.3,
    "learn": 0.1,
    "guess": 0.25,
    "slip": 0.08,
    "forget": 0.0,
    "model_variant": "default"
  },
  "processed_at": "2026-07-18T22:30:16Z"
}
```

### Frontend Can Now Query:
```http
GET /mastery/learners/42
→ See updated mastery: 0.276 (developing)

GET /priorities/learners/42/certifications/5/lessons
→ See "Loops" now marked CRITICAL with recommendation to review
```

---

## 🔐 Authentication

All endpoints require `X-API-Key` header (service-to-service):
```python
@require_service_key
def endpoint(...):
    # Only callable from authenticated services
    pass

# Configured via environment:
# BKT_SERVICE_API_KEY=<secret_key>
```

---

## 📈 Key Features

✅ **Bayesian Learning:** Real probabilistic modeling of knowledge  
✅ **Parameter Tuning:** Different parameters per lesson/difficulty/assessment type  
✅ **Idempotent Processing:** Duplicate events safely handled  
✅ **Audit Trail:** Full history of mastery changes with event snapshots  
✅ **Priority Recommendations:** Automatic "what to study next" suggestions  
✅ **Concurrent Safe:** Locks prevent race conditions on mastery updates  
✅ **PyBKT Integration:** Can train models using historical data  
✅ **Extensible:** Easy to add new priority algorithms or mastery levels  

---

## 🔧 Configuration

```yaml
# .env
DATABASE_URL=postgresql://user:pass@localhost/rebyu_bkt
BKT_SERVICE_API_KEY=<secret>
DEBUG=false

# Mastery level thresholds
DEVELOPING_THRESHOLD=0.3    # Start of "developing"
GOOD_THRESHOLD=0.6          # Start of "good"
MASTERED_THRESHOLD=0.8      # Start of "mastered"

# Priority computation
CRITICAL_SCORE_THRESHOLD=0.8
HIGH_SCORE_THRESHOLD=0.6
MEDIUM_SCORE_THRESHOLD=0.4
```

---

## 📚 Example Learner Journey

**Monday:** Student takes QUIZ on "Loops" (hard)
- Mastery: 0.0 → 0.15 (incorrect)
- Level: weak
- Priority: CRITICAL

**Wednesday:** Student reviews lesson and takes QUIZ again
- Mastery: 0.15 → 0.55 (correct)
- Level: developing
- Priority: MEDIUM (improving)

**Friday:** Student takes MOCK_EXAM with harder questions
- Mastery: 0.55 → 0.72 (mostly correct)
- Level: good
- Priority: LOW (on track)

**Next Week:** Another QUIZ (easy) - student breezes through
- Mastery: 0.72 → 0.88 (correct)
- Level: mastered
- Priority: STRONG → next topic unlocked

---

## 🧪 Testing BKT Math

```python
# tests/test_bkt_math.py
from app.services.bkt_math import update_mastery, mastery_level

def test_correct_answer_increases_mastery():
    result = update_mastery(
        mastery_before=0.5,
        is_correct=True,
        learn=0.1,
        guess=0.2,
        slip=0.05,
    )
    assert result.mastery_after > 0.5  # Knowledge increased
    assert result.mastery_level == "good"  # 60-80% range

def test_incorrect_answer_decreases_mastery():
    result = update_mastery(
        mastery_before=0.5,
        is_correct=False,
        learn=0.1,
        guess=0.2,
        slip=0.05,
    )
    assert result.mastery_after < 0.5  # Knowledge decreased
```

---

## 📞 Common Operations

### Reset Learner Progress
```http
DELETE /mastery/learners/42/lessons/10

Resets mastery_probability to prior, clears event history (optional)
```

### Get Full Mastery History
```http
GET /mastery/learners/42/certifications/5/history?limit=100

Returns: [{event_id, previous_mastery, final_mastery, ...}]
```

### Recalculate Priorities
```http
POST /priorities/recalculate

{
  "learner_id": 42,
  "certification_id": 5
}

Recomputes all lesson/category priorities from events
```

---

This Python BKT service is the engine powering REBYU's adaptive learning system!
