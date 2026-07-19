# Rebyu BKT FastAPI Backend

A complete Python backend for Rebyu's Bayesian Knowledge Tracing feature.

It combines:

- **FastAPI** for internal REST APIs and OpenAPI documentation.
- **PostgreSQL + SQLAlchemy + Alembic** for BKT parameters, model runs, mastery, and event history.
- **pyBKT** for periodic parameter training and model-variant comparison.
- **Celery + Redis** for long-running training jobs and scheduled retraining.
- **Real-time Bayesian updates** for every learner answer.
- **Docker Compose** for local and server deployment.
- **Pytest** tests for the API, idempotency, fallback behavior, readiness, and BKT math.

## Architecture

```text
Rebyu assessment backend
        |
        | POST one committed answer
        v
FastAPI BKT service ------ PostgreSQL
        |                       |
        | enqueue training      | parameters, mastery,
        v                       | runs, event history
      Redis                     |
        |                       |
        v                       |
 Celery worker ---- pyBKT ------+
        |
        v
 model.joblib + CSV/JSON/PNG artifacts
```

There are two distinct operations:

1. **Online mastery update** — runs immediately after an answer is saved. It uses the latest trained parameters and does not refit pyBKT.
2. **Offline training** — periodically compares six BKT variants, selects the best one using a learner holdout, saves the model, replaces current lesson parameters, and rebuilds mastery from historical responses.

## Project structure

```text
app/
  api/routes/           FastAPI endpoints
  core/                 settings, service-key security, logging
  db/                   SQLAlchemy models and sessions
  ml/pipeline.py        pyBKT training and evaluation pipeline
  repositories/         database queries
  schemas/              Pydantic request/response models
  services/             online BKT, training, parameters, readiness
  workers/              Celery worker and weekly schedule
alembic/                 database migration
sql/                     Rebyu training view and SQL examples
sample_data/             2,304-row Rebyu-style demonstration dataset
examples/                integration and curl examples
tests/                   automated tests
```

## BKT design for Rebyu

| BKT concept | Rebyu source |
|---|---|
| Skill | `lesson_id` |
| Observation | `learner_exam_details.result` (`0` or `1`) |
| Guess/slip class | `EASY`, `AVERAGE`, or `HARD` |
| Learn/forget class | `DIAGNOSTIC`, `LESSON_QUIZ`, `MIDDLE_EXAM`, or `MOCK_EXAM` |
| Learner sequence | Ordered by `answered_at`, attempt, and exam-question record |

The trainer compares:

1. Simple BKT
2. BKT with forgetting
3. Difficulty-specific guess/slip
4. Difficulty-specific guess/slip with forgetting
5. Difficulty-specific guess/slip plus assessment-specific learning
6. Full Rebyu model: difficulty, assessment type, and forgetting

The selected model is based on validation AUC and RMSE using a learner-level holdout. Sparse lessons receive safe fallback parameters.

## Start with Docker

```bash
cp .env.example .env
# Change SERVICE_API_KEY and production credentials in .env.
docker compose up --build
```

Services:

- FastAPI: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

The API container automatically runs:

```bash
alembic upgrade head
```

## Sharing a database with the Java backend

This service can point at the SAME Postgres database the Java backend uses (for
example, the shared Neon instance) instead of its own separate database. Every
table this service owns lives in its own Postgres schema (`DB_SCHEMA`, default
`bkt`), created automatically the first time `alembic upgrade head` runs, so
nothing here can collide with Java's tables -- notably a legacy
`learner_lesson_mastery` table that already exists in `public` from an older
progress-tracking feature.

To share Java's database:

```bash
# .env
DATABASE_URL=postgresql+psycopg://<same-user>:<same-password>@<same-host>:5432/<same-db>
DB_SCHEMA=bkt
```

Then run migrations as usual (`alembic upgrade head`, or let the `api`
container do it on startup). Nothing on the Java side needs to change --
Java's Hibernate/Flyway setup only ever touches `public`.

## Connect to the existing Rebyu assessment tables

After the main Rebyu database tables exist, run:

```bash
psql "$DATABASE_URL" -f sql/create_training_view.sql
```

The view expects these existing tables:

- `learner_exam_details`
- `exam_questions`
- `questions`
- `exams`
- `exam_types`

The SQL assumes the exam-type field is `exam_types.code`. Change it to `name` or `type_name` in `sql/create_training_view.sql` when your schema uses a different field.

The service only reads historical assessment records through `rebyu_bkt_training_data_v`. It writes only to the BKT tables created by Alembic.

## Train with the included demo CSV

```bash
curl -X POST http://localhost:8000/api/v1/bkt/training/jobs/from-csv \
  -H "X-Service-Key: replace-with-a-long-random-internal-key" \
  -F "file=@sample_data/rebyu_bkt_demo_data.csv" \
  -F "requested_by=Glyzel" \
  -F "num_fits=1"
```

The response is a queued training run. Check it using:

```bash
curl -H "X-Service-Key: replace-with-a-long-random-internal-key" \
  http://localhost:8000/api/v1/bkt/training/jobs/RUN_ID
```

For production training from PostgreSQL:

```bash
curl -X POST http://localhost:8000/api/v1/bkt/training/jobs \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: replace-with-a-long-random-internal-key" \
  -d '{
    "source_type": "database",
    "certification_id": 1,
    "requested_by": "admin:1",
    "num_fits": 5
  }'
```

Omit `certification_id` to train across all certifications.

## Update mastery after every answer

Call this endpoint only after the learner answer transaction has committed:

```http
POST /api/v1/bkt/mastery/events
X-Service-Key: <internal key>
Content-Type: application/json
```

```json
{
  "source_event_id": "learner-exam-detail:12:44:991:1",
  "learner_id": 12,
  "lesson_id": 101,
  "question_id": 501,
  "is_correct": true,
  "difficulty_level": "AVERAGE",
  "assessment_type": "LESSON_QUIZ",
  "occurred_at": "2026-07-12T12:00:00+08:00"
}
```

`source_event_id` must be stable and unique. A recommended value is:

```text
learner-exam-detail:{learner_id}:{exam_id}:{exam_question_id}:{attempt_no}
```

Sending the same event again returns `"duplicate": true` and does not increment mastery or attempt count twice.

`examples/rebyu_assessment_hook.py` contains a Python/httpx integration function.

For strong delivery guarantees, use an **outbox table** in the main assessment backend: save the answer and outbox record in one transaction, then let a worker retry delivery to this API. Idempotency makes retries safe.

## Important endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/bkt/health/live` | Process health |
| GET | `/api/v1/bkt/health/ready` | Database readiness |
| POST | `/api/v1/bkt/training/jobs` | Train from the Rebyu database view |
| POST | `/api/v1/bkt/training/jobs/from-csv` | Train from an uploaded CSV |
| GET | `/api/v1/bkt/training/jobs` | List model runs |
| GET | `/api/v1/bkt/training/jobs/{run_id}` | Read training status and metrics |
| POST | `/api/v1/bkt/training/jobs/{run_id}/cancel` | Cancel a queued job |
| POST | `/api/v1/bkt/mastery/events` | Process one answer |
| POST | `/api/v1/bkt/mastery/events/batch` | Process up to 500 answers |
| GET | `/api/v1/bkt/mastery/learners/{learner_id}` | All lesson mastery for a learner |
| GET | `/api/v1/bkt/mastery/learners/{learner_id}/lessons/{lesson_id}` | One mastery record |
| DELETE | `/api/v1/bkt/mastery/learners/{learner_id}/lessons/{lesson_id}` | Reset mastery |
| GET | `/api/v1/bkt/models/active` | Active trained model artifact |
| GET | `/api/v1/bkt/models/lessons/{lesson_id}/parameters` | Aggregate and class-specific parameters |
| POST | `/api/v1/bkt/analytics/readiness` | Weighted readiness score |

All BKT endpoints support `X-Service-Key`. The check is disabled only when `SERVICE_API_KEY` is empty, which should be limited to local development.

## Mastery levels

| Probability | Level |
|---|---|
| Below `0.40` | `weak` |
| `0.40` to below `0.70` | `developing` |
| `0.70` to below `0.85` | `good` |
| `0.85` and above | `mastered` |

Thresholds are configurable in `.env`.

## Readiness score

The readiness endpoint combines available components and renormalizes their weights when a score is missing.

Default weights:

| Component | Weight |
|---|---:|
| Average BKT lesson mastery | 60% |
| Diagnostic | 5% |
| Lesson quizzes | 15% |
| Middle exams | 10% |
| Mock exam | 10% |

Example:

```bash
curl -X POST http://localhost:8000/api/v1/bkt/analytics/readiness \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: replace-with-a-long-random-internal-key" \
  -d '{
    "learner_id": 12,
    "lesson_ids": [101, 102, 103, 104],
    "diagnostic_score": 62,
    "lesson_quiz_score": 78,
    "middle_exam_score": 74,
    "mock_exam_score": 71
  }'
```

## Scheduled retraining

Celery Beat queues a database training run every Sunday at **2:00 AM Asia/Manila** by default. Configure it with:

```env
SCHEDULED_RETRAINING_ENABLED=true
SCHEDULED_RETRAINING_DAY_OF_WEEK=sun
SCHEDULED_RETRAINING_HOUR=2
SCHEDULED_RETRAINING_MINUTE=0
```

The scheduled task skips execution when another training run is already queued or running.

## Generated training artifacts

Each run receives its own directory under `ARTIFACT_DIR/<model_run_id>/`:

- `rebyu_bkt_model.joblib`
- `model_comparison.csv`
- `skill_data_quality.csv`
- `bkt_parameter_classes.csv`
- `bkt_parameters.csv`
- `bkt_parameters.json`
- `bkt_predictions.csv`
- `learner_lesson_mastery.csv`
- `bkt_model_run.json`
- cleaned training CSV
- model comparison chart
- mastery distribution chart

The database stores the active artifact path and SHA-256 checksum.

## Run without Docker

Use Python 3.11 or 3.12.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Start the worker and scheduler in separate terminals:

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=INFO --concurrency=1
celery -A app.workers.celery_app.celery_app beat --loglevel=INFO
```

For a local demonstration without Redis:

```env
CELERY_TASK_ALWAYS_EAGER=true
```

Then run:

```bash
python scripts/train_demo.py
```

## Tests

```bash
python -m pytest
```

The completed package currently passes eight tests. The pyBKT smoke test also completes against the bundled 2,304-row dataset and selects the `full_rebyu` candidate.

## Production notes

- Keep the BKT service on an internal network and set a strong `SERVICE_API_KEY`.
- Use one Celery training worker initially. pyBKT fitting is CPU intensive, so avoid running many fits concurrently on the API host.
- Mount `ARTIFACT_DIR` on persistent storage or replace local artifact storage with S3.
- Back up the BKT tables together with the Rebyu assessment database.
- Increase `BKT_NUM_FITS` to `5` or `10` only after measuring worker runtime.
- Train only after enough new responses are available. Real-time answer processing should update mastery, not retrain the model.
- Never use test-set performance as training input. The included pipeline holds out entire learners to reduce leakage.
