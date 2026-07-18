# BKT (Bayesian Knowledge Tracing) Implementation Guide

## Architecture Overview

REBYU uses **PyBKT** (Bayesian Knowledge Tracing) running in a separate **FastAPI service** to calculate learner mastery scores. The Java backend communicates with FastAPI using an event-driven outbox pattern for eventual consistency.

## System Flow

### 1. Assessment Submission → BKT Event Creation
```
User submits assessment (QUIZ/DIAGNOSTIC/MOCK_EXAM)
    ↓
AssessmentAttemptService.submitAttempt() grades answers locally
    ↓
BktOutboxService.enqueueForAttempt() creates BktMasteryEvent records
    ↓
Events stored in bkt_event_outbox table (PENDING status)
```

### 2. Event Dispatch → FastAPI Service
```
BktEventDispatcher runs every 10 seconds (scheduled)
    ↓
Claims batches from outbox using SKIP LOCKED
    ↓
BktClient.sendBatch() posts to FastAPI: POST /mastery/events/batch
    ↓
FastAPI PyBKT service calculates mastery scores
    ↓
Status updated to PROCESSED (or RETRY/DEAD_LETTER on failure)
```

### 3. Mastery Query → Learner Dashboard
```
Frontend calls: GET /api/bkt/me/confidence/{certificationId}
    ↓
BKTController delegates to BKTService
    ↓
BKTService.getConfidence() calls BktClient
    ↓
BktClient queries FastAPI: GET /priorities/learners/{id}/certifications/{id}/confidence
    ↓
Returns ConfidenceView with mastery levels and priorities
```

## Key Components

### Backend (Java/Spring)

**Files:**
- `BktOutboxService.java` - Enqueues events into outbox table
- `BktEventDispatcher.java` - Polls and dispatches to FastAPI (scheduled, @Scheduled)
- `BktClient.java` - HTTP client for FastAPI endpoints
- `BKTService.java` - Facade to BktClient (delegates all operations)
- `BKTController.java` - REST endpoints for learners to query mastery
- `BktEventOutbox` entity - Transactional outbox table
- `BktMasteryEvent` DTO - Event payload (serialized as snake_case for FastAPI)

**Endpoints:**
- `GET /api/bkt/me/confidence/{certificationId}` - Certification-level confidence
- `GET /api/bkt/me/lessons/{certificationId}` - Lesson-level priorities
- `GET /api/bkt/me/history/{certificationId}` - Mastery history events
- `GET /api/bkt/me/mastery` - Overall mastery across lessons

### FastAPI Service (Python)

**Endpoints:**
- `POST /mastery/events/batch` - Accepts BktMasteryEvent batches
- `GET /mastery/learners/{learnerId}` - Learner mastery view
- `GET /priorities/learners/{learnerId}/certifications/{certId}/lessons` - Lesson priorities
- `GET /priorities/learners/{learnerId}/certifications/{certId}/confidence` - Confidence summary
- `GET /mastery/learners/{learnerId}/certifications/{certId}/history` - Mastery history

Uses **PyBKT library** to calculate:
- pKnow: Probability of knowledge (0.0-1.0)
- Mastery levels: 0-4 derived from pKnow
- Learning transitions based on assessment performance

## Event Flow Detail

### Assessment Answer → BKT Event

When an assessment is submitted:

```java
// 1. Score answer locally (already implemented)
scoreAnswer(attemptQuestion, answer, points);

// 2. Create mastery event in outbox (happens automatically)
bktOutboxService.enqueueForAttempt(attempt, questions, answersByQuestionId);

// Event includes:
// - learner_id
// - certification_id
// - lesson_id (from question → lesson mapping)
// - is_correct (graded answer)
// - assessment_type (QUIZ, DIAGNOSTIC, MOCK_EXAM)
// - question_id, difficulty_level
// - category hierarchy (major/middle category)
// - timestamp
```

### Outbox Pattern Guarantees

- **Idempotent on FastAPI side**: Events have deterministic `source_event_id`
- **Retry with exponential backoff**: Failed events retry with increasing delays
- **Dead letter handling**: Events that fail repeatedly move to DEAD_LETTER
- **Worker coordination**: Multiple backend instances use SKIP LOCKED
- **Transaction safety**: Events enqueued in same transaction as assessment submission

## Configuration

### Enable/Disable BKT

```yaml
# application.yaml
bkt:
  enabled: true  # Set to false to disable BKT processing
  dispatch-interval-ms: 10000  # Check outbox every 10s
  dispatch-initial-delay-ms: 15000  # Wait 15s before first dispatch
  dispatch-batch-size: 100  # Process up to 100 events per batch
  max-retries: 5  # Max retry attempts before dead-letter
  retry-initial-delay-seconds: 5  # Start with 5s delay
  retry-max-delay-seconds: 3600  # Cap at 1 hour delay
```

### FastAPI URL

```yaml
# Define the FastAPI BKT service endpoint
# (configured via BktProperties and WebClient bean in BktConfig.java)
bkt:
  service-url: http://localhost:8001  # FastAPI service URL
```

## Mastery Levels (Derived from pKnow)

- **Level 0**: 0-20% confidence (Not Started)
- **Level 1**: 20-40% confidence (Familiarity)
- **Level 2**: 40-60% confidence (Beginning Competence)
- **Level 3**: 60-80% confidence (Intermediate)
- **Level 4**: 80%+ confidence (Mastery)

## Data Models

### BktMasteryEvent (sent to FastAPI)
```json
{
  "source_event_id": "attempt-12345:question-789",
  "learner_id": 1,
  "certification_id": 5,
  "lesson_id": 42,
  "lesson_title": "Variables and Data Types",
  "major_category_id": 1,
  "major_category_title": "Fundamentals",
  "middle_category_id": 3,
  "middle_category_title": "Programming Basics",
  "question_id": 789,
  "is_correct": true,
  "difficulty_level": "MEDIUM",
  "assessment_type": "QUIZ",
  "occurred_at": "2026-07-18T21:15:30Z"
}
```

### ConfidenceView (returned from FastAPI)
```json
{
  "learner_id": 1,
  "certification_id": 5,
  "overall_confidence": 0.75,
  "lessons_mastered": 5,
  "lessons_learning": 3,
  "lessons_not_started": 2,
  "overall_mastery_level": 3,
  "total_assessments": 12
}
```

## Troubleshooting

### Events stuck in PENDING status
Check if FastAPI service is running and accessible:
```bash
curl http://localhost:8001/health  # Adjust URL as needed
```

### Querying mastery returns empty
1. Verify assessment was submitted (check `assessment_attempts` table)
2. Check if `bkt_event_outbox` has records (with PROCESSED status)
3. Ensure FastAPI has processed the events (check FastAPI logs)

### Retry failures
Look at `bkt_event_outbox.last_error` column for the specific error message.
Use admin endpoint to reset failed events:
```
POST /admin/bkt/retry  # (implement if needed)
```

## Testing

### Local Testing
1. Start FastAPI BKT service on port 8001
2. Submit an assessment
3. Wait for dispatcher (or manually trigger)
4. Query mastery endpoint

### Example Test Flow
```bash
# 1. Submit assessment
curl -X POST http://localhost:8080/api/assessments/123/attempts \
  -H "Authorization: Bearer $TOKEN"

# 2. Wait for dispatcher or verify outbox
SELECT * FROM bkt_event_outbox WHERE status = 'PROCESSED';

# 3. Query mastery
curl http://localhost:8080/api/bkt/me/confidence/5 \
  -H "Authorization: Bearer $TOKEN"
```

## Future Enhancements

- [ ] Add admin endpoints for viewing/retrying outbox events
- [ ] Implement WebSocket for real-time mastery updates
- [ ] Add mastery trend analytics
- [ ] Integrate mastery into study recommendations
- [ ] Cache mastery results with TTL for performance
- [ ] Add mastery badges/milestones to gamification
