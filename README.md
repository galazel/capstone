# REBYU

An adaptive certification-review platform. Learners study a structured
curriculum, sit assessments that are graded per question type, and get a study
plan and a priority order built from what a Bayesian model believes they
actually know. Institutions buy seats for their learners; admins author the
curriculum, the question bank and the assessments behind it.

---

## Screenshots

> Images live in `docs/screenshots/`. See the note in that folder for the
> filenames each slot expects.

### Learner

| Learning path | Lesson |
| --- | --- |
| ![Learning path](docs/screenshots/learner-learning-path.png) | ![Lesson](docs/screenshots/learner-lesson.png) |

| Study plan | Analytics |
| --- | --- |
| ![Study plan](docs/screenshots/learner-study-plan.png) | ![Analytics](docs/screenshots/learner-analytics.png) |

| Assessment attempt | Challenge arena |
| --- | --- |
| ![Assessment attempt](docs/screenshots/learner-assessment-attempt.png) | ![Challenge arena](docs/screenshots/learner-challenge-arena.png) |

### Admin

| Certification | Question bank |
| --- | --- |
| ![Certification](docs/screenshots/admin-certification.png) | ![Question bank](docs/screenshots/admin-question-bank.png) |

| Lesson editor | Learners |
| --- | --- |
| ![Lesson editor](docs/screenshots/admin-lesson-editor.png) | ![Learners](docs/screenshots/admin-learners.png) |

---

## What it does

**Curriculum.** A certification holds major categories, modules and lessons.
Lessons are authored block by block — headings, lists, images, video, tabs,
accordions, flip cards — in a three-pane editor.

**Assessments.** Diagnostic, lesson quiz, middle and major unit exams, mock
exam, plus two authoring-time types. Every attempt snapshots its questions, so
a paper cannot change under a learner mid-attempt. Question types:

| Type | Graded by |
| --- | --- |
| Multiple choice | exact match |
| Short answer | accepted variations |
| Descriptive | rubric |
| Programming | Judge0, against test cases |
| Diagram | structural comparison with a reference diagram |

Retaking a normal exam rebuilds the paper adaptively, weighted toward the
learner's weakest (lesson, difficulty) cells. Challenge arenas are exempt — an
arena *is* its problem set.

**Adaptive model.** A FastAPI service runs Bayesian Knowledge Tracing over
answered questions, maintaining a mastery probability per lesson and a priority
tag (critical → strong) that drives what the platform recommends next. Mastery
moves with answered questions, not with lessons read. Reported mastery is
capped near observed accuracy, so a short correct streak cannot read as
mastered on untrained parameters.

**Study plans.** One plan spans whichever enrolled certifications a learner
picks, each with its own start and target exam date. It schedules three
techniques as dated activities: Active Recall (assembled as a RECALL exam),
Pomodoro, and SM-2 spaced repetition.

**Challenges.** Three arenas — CodeStrike (programming), Blueprint Arena
(diagrams) and World Cup. An admin configures each arena's problems and the
industries allowed in; arenas with no problems stay locked for learners.

**Institutions.** Organisations buy certificate seats, invite learners, group
them, and track progress. Partnership requests are reviewed by an admin.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind, shadcn/ui, React Query, React Router |
| Backend | Spring Boot 4, Java 21, Hibernate |
| Adaptive service | FastAPI, SQLAlchemy, Celery, Redis, RabbitMQ |
| Database | PostgreSQL 16 |
| Vectors | Qdrant |
| Auth | AWS Cognito |
| Code execution | Judge0 |

---

## Running it

Everything runs under Docker Compose:

```bash
docker compose up -d
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Java API | http://localhost:8080 |
| Adaptive service | http://localhost:8000 |
| RabbitMQ console | http://localhost:15672 |
| Qdrant | http://localhost:6333 |
| Postgres | localhost:5432 |

Rebuild a service after changing its source — the images are built, not
mounted:

```bash
docker compose build frontend && docker compose up -d frontend
```

For a deployment outside the local Compose stack, pass the public API origin
at build time. Vite embeds this value in the static bundle; setting it only in
the running nginx container is too late:

```bash
docker build --build-arg VITE_API_URL=https://backend-production-20f5.up.railway.app -t rebyu-frontend ./frontend
```

### Configuration

Each service reads its own `.env`, which is **not** in version control:

| File | Holds |
| --- | --- |
| `backend-java/.env` | database URL, Cognito pool and client, Judge0 |
| `python-backend/.env` | database URL, broker URL, BKT parameters and thresholds |
| `frontend/.env` | API base URLs |

Copy the matching `.env.example` where one exists and fill in the values.

---

## Repository layout

```
backend-java/     Spring Boot API — curriculum, assessments, institutions,
                  gamification, challenges, billing
python-backend/   FastAPI adaptive service — BKT, priorities, Celery workers
frontend/         React SPA — learner, admin and institution portals
docs/             Documentation and screenshots
```

---

## Notes for contributors

**Flyway does not run.** Migrations under `resources/db/migration` are inert —
the Boot 4 module is absent. JPA entities with `ddl-auto: update` are the only
schema authority. Change the entity, not a migration.

**Icons are generated.** `frontend/src/components/icons.tsx` is produced from a
map; edit the map and run `npm run icons` rather than the file itself.

**The database is remote.** Neon Postgres in ap-southeast-1 — the first request
after an idle period pays a cold start of a few seconds. Batch reads across a
list rather than issuing one query per row.
