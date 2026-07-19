# Python Backend - BKT Main Implementation Files

## Overview
The Python backend uses **PyBKT library** for training but implements its own **real-time Bayesian Knowledge Tracing (BKT) math** for live mastery calculations. Here's the structure:

---

## 🔴 Core BKT Math Implementation

### **File: `app/services/bkt_math.py`**
**Purpose:** Core BKT formula implementation (NOT using PyBKT library)

**Key Functions:**
```python
def update_mastery(
    mastery_before: float,
    is_correct: bool,
    learn: float,
    guess: float,
    slip: float,
    forget: float = 0.0,
) -> BktUpdateResult
```

**What it does:**
- Takes current mastery probability and observation (correct/incorrect)
- Calculates posterior probability using Bayes rule
- Applies learning transition
- Returns: `mastery_after` (new mastery probability)

**Formula:**
```
If correct:
  numerator = p * (1 - slip)
  denominator = numerator + (1 - p) * guess
  posterior = numerator / denominator
  mastery_after = posterior * (1 - forget) + (1 - posterior) * learn

If incorrect:
  numerator = p * slip
  denominator = numerator + (1 - p) * (1 - guess)
  posterior = numerator / denominator
  mastery_after = posterior * (1 - forget) + (1 - posterior) * learn
```

**Also provides:**
```python
def mastery_level(probability, developing_threshold, good_threshold, mastered_threshold) -> str
```
Returns: "weak" | "developing" | "good" | "mastered"

---

## 🟢 FastAPI ML Training Pipeline

### **File: `app/ml/pipeline.py`**
**Purpose:** Offline training using **PyBKT library** (trains once, exports parameters)

**Key Features:**
- Uses `from pyBKT.models import Model` (real PyBKT library)
- Fits multiple candidate models and selects best
- Exports trained parameters to CSV/JSON for runtime use

**Candidates trained:**
1. `simple` - Basic BKT
2. `forgetting` - With forgetting parameter
3. `difficulty_guess_slip` - Difficulty-dependent guessing/slipping
4. `difficulty_guess_slip_forgetting` - All above
5. `difficulty_and_assessment_learning` - Difficulty + assessment-type learning
6. `full_rebyu` - All parameters + multi-class (BEST)

**Output artifacts:**
- `bkt_parameters.csv` - Aggregated parameters per lesson
- `bkt_parameter_classes.csv` - Detailed parameters per difficulty/assessment-type
- `learner_lesson_mastery.csv` - Latest mastery for all learner-lesson pairs
- `rebyu_bkt_model.joblib` - Pickled PyBKT Model object

**Thresholds:**
```python
MASTERED_THRESHOLD = 0.85       # mastery >= 85%
GOOD_THRESHOLD = 0.70           # mastery >= 70%
DEVELOPING_THRESHOLD = 0.40     # mastery >= 40%
```

---

## 🔵 Real-Time Event Processing

### **File: `app/services/mastery_service.py`**
**Purpose:** Processes live assessment events and calculates mastery updates

**Main function:**
```python
def process_mastery_event(session: Session, payload: MasteryEventCreate) -> MasteryEventResponse
```

**What it does:**
1. Looks up learner's current mastery for the lesson
2. Resolves BKT parameters (from trained model)
3. Calls `update_mastery()` with parameters
4. Calculates new mastery level
5. Updates `LearnerLessonMastery` table
6. Creates audit trail in `LearnerLessonMasteryHistory`

**Flow:**
```
Assessment Event (from Java)
    ↓
MasteryEventCreate payload
    ↓
process_mastery_event()
    ├─ Get current mastery
    ├─ Resolve parameters (from trained model)
    ├─ Call update_mastery(parameters)
    ├─ Call mastery_level(new_mastery)
    ├─ Update LearnerLessonMastery table
    ├─ Create BktMasteryEvent (audit)
    ├─ Create LearnerLessonMasteryHistory
    └─ Return response to Java
```

---

## 🟡 Parameter Resolution

### **File: `app/services/parameter_service.py`**
**Purpose:** Looks up correct BKT parameters based on lesson, difficulty, assessment-type

**Main function:**
```python
def resolve_parameters(
    session: Session,
    lesson_id: Long,
    difficulty_level: str,
    assessment_type: str,
) -> Parameters
```

**How it works:**
1. Queries `bkt_parameters` table for lesson's trained parameters
2. If difficulty/assessment-type variants exist, uses them
3. Falls back to defaults if not trained on that combination
4. Returns: `prior`, `learn`, `guess`, `slip`, `forget`

**Fallback defaults:**
```python
FALLBACK_PARAMETERS = {
    "prior": 0.30,
    "learns": 0.20,
    "guesses": 0.25,
    "slips": 0.10,
    "forgets": 0.00,
}
```

---

## 🟣 API Endpoints

### **File: `app/api/routes/mastery.py`**
**Purpose:** FastAPI endpoints for BKT operations

**Main endpoint:**
```python
POST /mastery/events/batch
```
Receives batch of assessment events, processes each via `mastery_service.process_mastery_event()`

**Other routes:**
- `GET /mastery/learners/{learner_id}` - Get learner's mastery
- `GET /mastery/history` - Get mastery progression

---

## 🟠 Database Models

### **File: `app/db/models.py`**
**Key tables:**

1. **`LearnerLessonMastery`** (current state)
   - `learner_id`, `lesson_id` (PK)
   - `mastery_probability` (0.0-1.0)
   - `mastery_level` (weak/developing/good/mastered)
   - `attempt_count`, `correct_count`, `incorrect_count`
   - `last_updated`, `last_event_id`

2. **`BktMasteryEvent`** (event log)
   - `source_event_id` (PK, from Java)
   - `learner_id`, `lesson_id`, `question_id`
   - `is_correct`
   - `mastery_before`, `mastery_posterior`, `mastery_after`
   - `predicted_correct_probability`
   - `parameters_used` (JSON)
   - `processed_at`

3. **`LearnerLessonMasteryHistory`** (audit trail for analytics)
   - `event_id`, `learner_id`, `certification_id`, `lesson_id`
   - `previous_mastery`, `final_mastery`
   - `previous_mastery_level`, `new_mastery_level`
   - `observed_correct`, `assessment_type`, `difficulty_level`
   - `model_version`, `created_at`

4. **`BktParameter`** (trained parameters)
   - `lesson_id` (PK)
   - `prior_probability`, `learn_probability`, `guess_probability`, `slip_probability`, `forget_probability`
   - `model_variant` (which trained model)
   - `last_trained_at`

---

## 📊 Architecture Diagram

```
┌─ Training Phase (Offline - quarterly/annually) ─────────────┐
│                                                               │
│  Historical Data (CSV)                                        │
│         ↓                                                      │
│  app/ml/pipeline.py (PyBKT)                                   │
│  - Fit multiple candidate models                             │
│  - Choose best by AUC/RMSE                                   │
│  - Extract parameters                                        │
│         ↓                                                      │
│  Trained Models & Parameters (CSV, JSON, joblib)             │
│  Store in: BktParameter table                                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌─ Runtime Phase (Real-time - per assessment) ────────────────┐
│                                                               │
│  Assessment Event (from Java)                                 │
│         ↓                                                      │
│  app/api/routes/mastery.py                                    │
│  POST /mastery/events/batch                                  │
│         ↓                                                      │
│  app/services/mastery_service.py                              │
│  process_mastery_event()                                     │
│    ├─ Resolve parameters (from trained model)                │
│    ├─ Call update_mastery() [bkt_math.py]                    │
│    ├─ Update LearnerLessonMastery                            │
│    ├─ Record BktMasteryEvent                                 │
│    └─ Return response                                        │
│         ↓                                                      │
│  Response to Java Backend                                     │
│         ↓                                                      │
│  Frontend fetches via /api/bkt/me/* endpoints                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🔧 How Parameters Flow

### Training (once)
```
1. Collect historical assessment data
2. Run app/ml/pipeline.py
3. PyBKT fits models using Expectation-Maximization
4. Extract parameters per skill/difficulty/assessment-type
5. Store in BktParameter table + CSV/JSON files
```

### Runtime (per assessment)
```
1. Assessment submitted by learner
2. Java enqueues event to BKT service
3. Python receives in /mastery/events/batch
4. For each event:
   - Resolve parameters: parameter_service.resolve_parameters()
     Gets from BktParameter table, with fallbacks
   - Update mastery: bkt_math.update_mastery()
     Uses resolved parameters
   - Calculate level: bkt_math.mastery_level()
   - Save to LearnerLessonMastery
5. Return response to Java
```

---

## 📝 Key Files Reference

| File | Purpose | PyBKT used? |
|------|---------|------------|
| `app/services/bkt_math.py` | Core BKT math (Bayes formula) | ❌ Custom |
| `app/ml/pipeline.py` | Model training pipeline | ✅ Yes (training) |
| `app/services/mastery_service.py` | Event processing | ❌ No (uses trained params) |
| `app/services/parameter_service.py` | Parameter resolution | ❌ No (lookup) |
| `app/api/routes/mastery.py` | FastAPI endpoints | ❌ No (routing) |
| `app/db/models.py` | Database entities | ❌ No (schema) |

---

## 🚀 Deployment Workflow

### First Time Setup
```bash
# Prepare historical training data
python -m app.ml.pipeline --input data.csv --output artifacts/

# Manually load parameters into DB:
# - Copy bkt_parameters.csv → BktParameter table
# - Or run app/db/init_db.py with seeding
```

### Live Operation
```bash
# Python FastAPI service runs continuously
# Listens on POST /mastery/events/batch
# Processes events real-time using trained parameters
```

### Retrain Quarterly/Annually
```bash
# Re-run pipeline with updated data
# New parameters replace old ones in DB
# No service restart needed
```

---

## ✅ Summary

**PyBKT is used:**
- ✅ **Training phase** (app/ml/pipeline.py) - Offline model fitting
- ❌ **Runtime phase** - Uses custom BKT math + trained parameters

**Real-time mastery updates:**
- Use `app/services/bkt_math.py` (custom implementation)
- Parameters come from trained models (stored in DB)
- No PyBKT library needed at runtime
- Fast, deterministic calculations

**Data flow:**
1. Historical data → PyBKT trains models (offline)
2. Parameters stored in BktParameter table
3. Real-time events → Custom math with stored parameters (online)
4. Results → Frontend displays mastery/priorities
