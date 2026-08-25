# REBYU — DATA DICTIONARY

Derived from the JPA entities in `backend-java/src/main/java/com/capstone/rebyu`. Data types follow the PostgreSQL mapping Hibernate generates (Long → BIGINT, String → VARCHAR, LocalDateTime → TIMESTAMP, OffsetDateTime → TIMESTAMP WITH TIME ZONE, BigDecimal → DECIMAL, boolean → BOOLEAN).

---

## 1. USER MANAGEMENT

### DATA DICTIONARY OF USER_TYPES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| user_type_id | PK, identity | BIGINT | No | Unique identifier for a user type. |
| user_type_text | NOT NULL | VARCHAR(20) | No | Name of the role, such as learner, admin, or institution. |

The USER_TYPES table stores the account role classifications of the platform. Many users can reference each user type.

### DATA DICTIONARY OF USERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| user_id | PK, identity | BIGINT | No | Unique identifier for a user account. |
| user_type_id | FK → USER_TYPES, NOT NULL | BIGINT | No | Role of the account (learner, admin, institution). |
| email | UNIQUE, NOT NULL | VARCHAR(254) | No | Login e-mail address of the account. |
| password_hash | NOT NULL | VARCHAR(255) | No | Hashed password of the account. |
| account_status | NOT NULL | VARCHAR(20) | No | Account state: active, inactive, or suspended. Defaults to active. |
| joined_at | NOT NULL | TIMESTAMP | No | Date and time the account was created. |
| phone_number | — | VARCHAR(30) | Yes | Contact number of the user. |
| cognito_sub | UNIQUE | VARCHAR(64) | Yes | Stable Amazon Cognito subject linked to this account; null for pre-Cognito accounts until their first federated sign-in. |

The USERS table stores every account on the platform. Each user belongs to one user type, and a user can own one learner profile, many activity logs, and many institution memberships.

### DATA DICTIONARY OF LEARNERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK, identity | BIGINT | No | Unique identifier for a learner profile. |
| user_id | FK → USERS, UNIQUE | BIGINT | Yes | Account that owns this learner profile (one-to-one). |
| username | UNIQUE, NOT NULL | VARCHAR(50) | No | Public display username of the learner. |
| first_name | NOT NULL | VARCHAR(50) | No | Learner's first name. |
| last_name | NOT NULL | VARCHAR(50) | No | Learner's last name. |
| readiness_score | NOT NULL | DECIMAL(38,2) | No | Computed exam-readiness score of the learner. Defaults to 0. |
| confidence_level | NOT NULL | DECIMAL(38,2) | No | Computed confidence level of the learner. Defaults to 0. |

The LEARNERS table stores the learner profile linked one-to-one with a user account. A learner owns enrollments, attempts, achievements, community activity, and progress records.

---

## 2. CERTIFICATION CONTENT

### DATA DICTIONARY OF CERTIFICATIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| certification_id | PK, identity | BIGINT | No | Unique identifier for a certification. |
| title | UNIQUE, NOT NULL | VARCHAR(150) | No | Title of the certification. |
| description | NOT NULL | TEXT | No | Full description of the certification. |
| image_key | — | VARCHAR(255) | Yes | S3 key of the certification cover image. |
| date_created | — | TIMESTAMP | Yes | Date and time the certification was created. |
| industry | — | VARCHAR(255) | Yes | Industry the certification belongs to. |
| date_updated | — | TIMESTAMP | Yes | Date and time the certification was last updated. |
| status | — | SMALLINT (enum ordinal) | Yes | Lifecycle state: 0 = PUBLISHED, 1 = DRAFT. Defaults to DRAFT. |

The CERTIFICATIONS table stores the review programs offered by the platform. One certification contains many major categories and is referenced by exams, enrollments, orders, and organization allocations.

### DATA DICTIONARY OF MAJOR_CATEGORIES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| major_category_id | PK, identity | BIGINT | No | Unique identifier for a major category. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification this major category belongs to. |
| title | NOT NULL | VARCHAR(150) | No | Title of the major category. |

The MAJOR_CATEGORIES table stores the top-level curriculum divisions of a certification. One major category contains many middle categories.

### DATA DICTIONARY OF MIDDLE_CATEGORIES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| middle_category_id | PK, identity | BIGINT | No | Unique identifier for a middle category. |
| major_category_id | FK → MAJOR_CATEGORIES, NOT NULL | BIGINT | No | Major category this middle category belongs to. |
| title | NOT NULL | VARCHAR(150) | No | Title of the middle category. |

The MIDDLE_CATEGORIES table stores the second-level curriculum divisions. One middle category contains many lessons.

### DATA DICTIONARY OF LESSONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| lesson_id | PK, identity | BIGINT | No | Unique identifier for a lesson. |
| middle_category_id | FK → MIDDLE_CATEGORIES, NOT NULL | BIGINT | No | Middle category this lesson belongs to. |
| name | NOT NULL | VARCHAR(150) | No | Name of the lesson. |
| lesson_component_structure | NOT NULL | JSON | No | JSON structure of the lesson's content components (sections, text, media). Defaults to []. |

The LESSONS table stores the individual study units of a certification. One lesson owns many questions and is referenced by quizzes, mastery, weak areas, and completion records.

### DATA DICTIONARY OF LESSON_IMAGES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| lesson_image_id | PK, identity | BIGINT | No | Unique identifier for a lesson image. |
| lesson_id | NOT NULL | INT | No | Identifier of the lesson the image belongs to. |
| section_name | NOT NULL | VARCHAR(255) | No | Lesson section where the image is placed. |
| tool_id | NOT NULL | VARCHAR(255) | No | Editor tool/block identifier that references the image. |
| image_key | NOT NULL | VARCHAR(500) | No | S3 key of the stored image file. |

The LESSON_IMAGES table stores images embedded inside lesson content. Many images can belong to one lesson.

### DATA DICTIONARY OF LESSON_VIDEOS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| lesson_video_id | PK, identity | BIGINT | No | Unique identifier for a lesson video. |
| lesson_id | NOT NULL | INT | No | Identifier of the lesson the video belongs to. |
| section_name | NOT NULL | VARCHAR(255) | No | Lesson section where the video is placed. |
| tool_id | NOT NULL | VARCHAR(255) | No | Editor tool/block identifier that references the video. |
| video_key | NOT NULL | VARCHAR(500) | No | S3 key of the stored video file. |

The LESSON_VIDEOS table stores videos embedded inside lesson content. Many videos can belong to one lesson.

---

## 3. QUESTION BANK

### DATA DICTIONARY OF QUESTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| question_id | PK, identity | BIGINT | No | Unique identifier for a question. |
| parent_question_id | FK → QUESTIONS (self) | BIGINT | Yes | Parent question when this row is a sub-question (e.g. critical-thinking sets). |
| question_type | NOT NULL | VARCHAR(30) | No | Type of question (multiple choice, short answer, descriptive, programming, diagram, etc.). |
| difficulty_level | NOT NULL | VARCHAR(10) | No | Difficulty rating of the question (e.g. easy, medium, hard). |
| question_text | NOT NULL | TEXT | No | The question prompt shown to the learner. |
| image_key | — | VARCHAR(255) | Yes | S3 key of an image attached to the question. |
| lesson_id | FK → LESSONS, NOT NULL | BIGINT | No | Lesson the question belongs to. |
| total_points | NOT NULL | DECIMAL(5,2) | No | Default points awarded for a correct answer. Defaults to 1.00. |

The QUESTIONS table stores every question in the question bank. One question owns many choices, optional type-specific configs (text, programming, diagram), rubric criteria, and may parent sub-questions.

### DATA DICTIONARY OF CHOICES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| choice_id | PK, identity | BIGINT | No | Unique identifier for an answer choice. |
| question_id | FK → QUESTIONS, NOT NULL | BIGINT | No | Question this choice belongs to. |
| choice_text | NOT NULL | TEXT | No | Text of the answer option. |
| image_key | — | VARCHAR(255) | Yes | S3 key of an image attached to the choice. |
| is_correct | NOT NULL | BOOLEAN | No | Whether this choice is the correct answer. |
| explanation | — | TEXT | Yes | Explanation shown when reviewing the answer. |

The CHOICES table stores the answer options of multiple-choice questions. Many choices belong to one question.

### DATA DICTIONARY OF TEXT_QUESTION_CONFIGS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| text_question_config_id | PK, identity | BIGINT | No | Unique identifier for a text-question configuration. |
| question_id | FK → QUESTIONS, UNIQUE, NOT NULL | BIGINT | No | Question this configuration belongs to (one-to-one). |
| correct_answer | NOT NULL | TEXT | No | The expected correct answer text. |
| checking_method | NOT NULL | VARCHAR(30) | No | How the answer is checked (e.g. EXACT_MATCH, AI). Defaults to EXACT_MATCH. |
| accepted_variations | — | TEXT | Yes | Optional exact-match alternative answers, one per line. |

The TEXT_QUESTION_CONFIGS table stores the answer key of short-answer and descriptive questions. Each configuration belongs to exactly one question.

### DATA DICTIONARY OF PROGRAMMING_QUESTION_CONFIGS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| programming_question_config_id | PK, identity | BIGINT | No | Unique identifier for a programming-question configuration. |
| question_id | FK → QUESTIONS, UNIQUE, NOT NULL | BIGINT | No | Question this configuration belongs to (one-to-one). |
| starter_code | — | TEXT | Yes | Starter code pre-loaded in the learner's editor. |

The PROGRAMMING_QUESTION_CONFIGS table stores the coding setup of programming questions. One configuration owns many programming test cases.

### DATA DICTIONARY OF PROGRAMMING_TEST_CASES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| programming_test_case_id | PK, identity | BIGINT | No | Unique identifier for a test case. |
| programming_question_config_id | FK → PROGRAMMING_QUESTION_CONFIGS, NOT NULL | BIGINT | No | Programming configuration this test case belongs to. |
| input_data | NOT NULL | TEXT | No | Standard input fed to the learner's program. |
| expected_output | NOT NULL | TEXT | No | Expected standard output for the test to pass. |
| is_sample | NOT NULL | BOOLEAN | No | Whether the case is a learner-visible sample; hidden otherwise. Defaults to false. |

The PROGRAMMING_TEST_CASES table stores the input/output pairs used to grade programming answers. Many test cases belong to one programming configuration.

### DATA DICTIONARY OF DIAGRAM_QUESTION_CONFIGS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| diagram_question_config_id | PK, identity | BIGINT | No | Unique identifier for a diagram-question configuration. |
| question_id | FK → QUESTIONS, UNIQUE, NOT NULL | BIGINT | No | Question this configuration belongs to (one-to-one). |
| diagram_type | NOT NULL | VARCHAR(30) | No | Type of diagram expected (e.g. ERD, flowchart, UML). |
| instructions | — | TEXT | Yes | Additional drawing instructions for the learner. |
| reference_diagram_xml | NOT NULL | TEXT | No | Reference (correct) diagram in XML form. |
| reference_diagram_json | NOT NULL | JSONB | No | Reference diagram as structured JSON used for grading. |

The DIAGRAM_QUESTION_CONFIGS table stores the reference solution of diagram questions. Each configuration belongs to exactly one question.

### DATA DICTIONARY OF QUESTION_RUBRIC_CRITERIA

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| rubric_criterion_id | PK, identity | BIGINT | No | Unique identifier for a rubric criterion. |
| question_id | FK → QUESTIONS, NOT NULL | BIGINT | No | Question this rubric line belongs to. |
| name | NOT NULL | VARCHAR(150) | No | Name of the grading criterion. |
| max_points | NOT NULL | DECIMAL(5,2) | No | Maximum points awardable for this criterion. Defaults to 1.00. |
| display_order | NOT NULL | INT | No | Ordering of the criterion in the rubric. Defaults to 1. |

The QUESTION_RUBRIC_CRITERIA table stores the rubric lines of subjectively graded questions (diagram/descriptive). Many criteria belong to one question.

---

## 4. EXAMS AND LEGACY RESULTS

### DATA DICTIONARY OF EXAM_TYPES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| exam_type_id | PK, identity | BIGINT | No | Unique identifier for an exam type. |
| exam_type_text | UNIQUE, NOT NULL | VARCHAR(50) | No | Name of the exam type, such as quiz, diagnostic, or mock exam. |

The EXAM_TYPES table stores the classifications of assessments. Many exams can reference each exam type.

### DATA DICTIONARY OF EXAMS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| exam_id | PK, identity | BIGINT | No | Unique identifier for an exam/assessment. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification the exam belongs to. |
| exam_type_id | FK → EXAM_TYPES, NOT NULL | BIGINT | No | Type of the exam (quiz, diagnostic, mock, etc.). |
| title | NOT NULL | VARCHAR(150) | No | Title of the exam. |
| is_generated | NOT NULL | BOOLEAN | No | Whether the exam was AI-generated. Defaults to false. |
| duration_minutes | — | INT | Yes | Time limit in minutes; null means untimed. |
| total_questions | NOT NULL | INT | No | Number of questions in the exam. |
| passing_score | NOT NULL | DECIMAL(5,2) | No | Passing percentage. Defaults to 70.00. |
| status | — | VARCHAR(20) | Yes | Lifecycle state: DRAFT, PUBLISHED, or ARCHIVED; null is treated as DRAFT. |
| description | — | TEXT | Yes | Description shown to learners. |
| instructions | — | TEXT | Yes | Instructions shown before starting. |
| lesson_id | FK → LESSONS | BIGINT | Yes | Lesson scope; required for QUIZ-type exams. |
| middle_category_id | FK → MIDDLE_CATEGORIES | BIGINT | Yes | Set for middle-category-scoped assessments. |
| major_category_id | FK → MAJOR_CATEGORIES | BIGINT | Yes | Set for major-category-scoped assessments. |
| target_scope | — | VARCHAR(20) | Yes | Scope of the assessment: LESSON, MIDDLE_CATEGORY, MAJOR_CATEGORY, or CERTIFICATION. |
| published_at | — | TIMESTAMP | Yes | Date and time the exam was published. |
| updated_at | — | TIMESTAMP | Yes | Date and time the exam was last updated. |
| release_answers_after_submit | — | BOOLEAN | Yes | Whether answer keys are released after submission; null is treated as true. |

The EXAMS table stores every assessment (quiz, diagnostic, mock exam) of a certification. One exam contains many exam questions and is referenced by attempts and results.

### DATA DICTIONARY OF EXAM_QUESTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| exam_question_id | PK, identity | BIGINT | No | Unique identifier for an exam–question link. |
| exam_id | FK → EXAMS, NOT NULL | BIGINT | No | Exam the question is placed in. |
| question_id | FK → QUESTIONS, NOT NULL | BIGINT | No | Question bank item placed in the exam. |
| display_order | NOT NULL | INT | No | Position of the question in the exam. |
| points | — | DECIMAL(5,2) | Yes | Per-assessment point override; null falls back to the question's own total points. |

The EXAM_QUESTIONS table is the junction between exams and questions. One exam contains many exam questions, and one question can appear in many exams.

### DATA DICTIONARY OF EXAM_CHOICES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| exam_question_id | PK (composite), FK → EXAM_QUESTIONS | BIGINT | No | Exam question the choice ordering belongs to. |
| choice_id | PK (composite), FK → CHOICES | BIGINT | No | Choice being ordered for this exam question. |
| display_order | NOT NULL | INT | No | Position of the choice within the exam question. |

The EXAM_CHOICES table stores the per-exam ordering of answer choices. It is a junction table between exam questions and choices with a composite primary key.

### DATA DICTIONARY OF EXAM_RESULTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who took the exam. |
| exam_id | PK (composite), FK → EXAMS | BIGINT | No | Exam that was taken. |
| attempt_no | PK (composite) | INT | No | Sequence number of the attempt. |
| taken_at | NOT NULL | TIMESTAMP | No | Date and time the exam was taken. |
| score | NOT NULL | DECIMAL(5,2) | No | Final percentage score of the attempt. |
| duration_seconds | NOT NULL | INT | No | Time spent on the exam in seconds. |
| is_passed | NOT NULL | BOOLEAN | No | Whether the score met the passing score. |

The EXAM_RESULTS table stores the summarized outcome of each exam attempt. A learner can have many results per exam, distinguished by attempt number.

### DATA DICTIONARY OF LEARNER_EXAM_DETAILS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_exam_detail_id | PK, identity | BIGINT | No | Unique identifier for a per-question exam record. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who answered. |
| exam_id | FK → EXAMS, NOT NULL | BIGINT | No | Exam the answer belongs to. |
| attempt_no | NOT NULL | INT | No | Attempt number the answer belongs to. |
| exam_question_id | FK → EXAM_QUESTIONS, NOT NULL | BIGINT | No | Exam question that was answered. |
| question_id | FK → QUESTIONS, NOT NULL | BIGINT | No | Underlying question bank item. |
| lesson_id | FK → LESSONS, NOT NULL | BIGINT | No | Lesson the question belongs to, for analytics. |
| is_correct | NOT NULL | BOOLEAN | No | Whether the answer was correct. |
| answered_at | NOT NULL | TIMESTAMP | No | Date and time the answer was recorded. |
| earned_score | NOT NULL | DECIMAL(5,2) | No | Points earned on this question. Defaults to 0.00. |

The LEARNER_EXAM_DETAILS table stores the per-question result of an exam attempt. It links a learner, an exam, and a question, and is the parent of the type-specific answer tables below.

### DATA DICTIONARY OF LEARNER_MCQ_ANSWERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_mcq_answer_id | PK, identity | BIGINT | No | Unique identifier for a multiple-choice answer. |
| learner_exam_detail_id | FK → LEARNER_EXAM_DETAILS, NOT NULL | BIGINT | No | Per-question exam record this answer belongs to. |
| exam_question_id | FK → EXAM_QUESTIONS, NOT NULL | BIGINT | No | Exam question that was answered. |
| choice_id | FK → CHOICES, NOT NULL | BIGINT | No | Choice the learner selected. |

The LEARNER_MCQ_ANSWERS table stores the selected choice of multiple-choice answers. Many rows can belong to one learner exam detail.

### DATA DICTIONARY OF LEARNER_TEXT_ANSWERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_text_answer_id | PK, identity | BIGINT | No | Unique identifier for a text answer. |
| learner_exam_detail_id | FK → LEARNER_EXAM_DETAILS, UNIQUE, NOT NULL | BIGINT | No | Per-question exam record this answer belongs to (one-to-one). |
| answer_text | NOT NULL | TEXT | No | The learner's written answer. |

The LEARNER_TEXT_ANSWERS table stores free-text answers for short-answer and descriptive questions. Each row belongs to exactly one learner exam detail.

### DATA DICTIONARY OF LEARNER_PROGRAMMING_ANSWERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_programming_answer_id | PK, identity | BIGINT | No | Unique identifier for a programming answer. |
| learner_exam_detail_id | FK → LEARNER_EXAM_DETAILS, UNIQUE, NOT NULL | BIGINT | No | Per-question exam record this answer belongs to (one-to-one). |
| programming_language | NOT NULL | VARCHAR(30) | No | Language of the submitted code. |
| submitted_code | NOT NULL | TEXT | No | Source code submitted by the learner. |

The LEARNER_PROGRAMMING_ANSWERS table stores submitted code for programming questions. Each row belongs to exactly one learner exam detail.

### DATA DICTIONARY OF LEARNER_DIAGRAM_ANSWERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_diagram_answer_id | PK, identity | BIGINT | No | Unique identifier for a diagram answer. |
| learner_exam_detail_id | FK → LEARNER_EXAM_DETAILS, UNIQUE, NOT NULL | BIGINT | No | Per-question exam record this answer belongs to (one-to-one). |
| diagram_xml | NOT NULL | TEXT | No | The learner's submitted diagram in XML form. |
| diagram_json | NOT NULL | JSONB | No | The learner's submitted diagram as structured JSON used for grading. |

The LEARNER_DIAGRAM_ANSWERS table stores submitted diagrams for diagram questions. Each row belongs to exactly one learner exam detail.

---

## 5. ASSESSMENT ATTEMPT ENGINE

### DATA DICTIONARY OF ASSESSMENT_ATTEMPTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| assessment_attempt_id | PK, identity | BIGINT | No | Unique identifier for an attempt. |
| exam_id | FK → EXAMS, NOT NULL, UNIQUE(exam_id, learner_id, attempt_number) | BIGINT | No | Published exam being attempted. |
| learner_id | NOT NULL | BIGINT | No | Learner taking the attempt. |
| enrollment_id | — | BIGINT | Yes | LEARNER_CERTIFICATIONS id backing this attempt, when one exists. |
| attempt_number | NOT NULL | INT | No | Sequence number of this attempt per exam and learner. |
| status | NOT NULL | VARCHAR(20) | No | Attempt state: IN_PROGRESS, SUBMITTED, EXPIRED, or CANCELLED. |
| started_at | NOT NULL | TIMESTAMP | No | Date and time the attempt started. |
| submitted_at | — | TIMESTAMP | Yes | Date and time the attempt was submitted. |
| expires_at | — | TIMESTAMP | Yes | Deadline after which the attempt expires. |
| percentage | — | DECIMAL(5,2) | Yes | Score percentage (0–100) across all snapshot points; pending items score 0. |
| passed | — | BOOLEAN | Yes | Whether the attempt met the passing score. |
| total_points | — | DECIMAL(8,2) | Yes | Total possible points of the attempt. |
| earned_points | — | DECIMAL(8,2) | Yes | Points earned by the learner. |
| duration_seconds | — | INT | Yes | Time spent on the attempt in seconds. |
| current_question_id | — | BIGINT | Yes | Attempt-question id the learner last viewed, used for resume. |
| idempotency_key | UNIQUE | VARCHAR(100) | Yes | Key preventing duplicate attempt creation from retried requests. |
| version | Optimistic lock (@Version) | BIGINT | Yes | Version counter guarding concurrent updates. |

The ASSESSMENT_ATTEMPTS table stores one learner attempt of a published exam. Questions are snapshotted at start and answers are scored server-side on submit. One attempt owns many attempt questions, answers, and executions.

### DATA DICTIONARY OF ASSESSMENT_ATTEMPT_QUESTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| attempt_question_id | PK, identity | BIGINT | No | Unique identifier for a snapshotted attempt question. |
| assessment_attempt_id | FK → ASSESSMENT_ATTEMPTS, NOT NULL | BIGINT | No | Attempt this snapshot belongs to. |
| source_question_id | NOT NULL | BIGINT | No | Question bank id the snapshot was taken from. |
| question_type | NOT NULL | VARCHAR(30) | No | Type of the snapshotted question. |
| question_text_snapshot | NOT NULL | TEXT | No | Question text frozen at attempt start. |
| question_data_snapshot | — | TEXT | Yes | Learner-safe JSON: choices without correct flags, starter code, etc. |
| display_order | NOT NULL | INT | No | Position of the question in the attempt. |
| points | — | DECIMAL(5,2) | Yes | Points this item is worth in the attempt. |
| lesson_id | — | BIGINT | Yes | Lesson the source question belongs to, for analytics. |
| flagged | NOT NULL | BOOLEAN | No | Learner marked this item for review. Defaults to false. |
| skipped | NOT NULL | BOOLEAN | No | Learner intentionally moved past this item without answering. Defaults to false. |

The ASSESSMENT_ATTEMPT_QUESTIONS table stores the learner-visible snapshot of each question at attempt start; snapshots never contain answer keys, rubrics, or reference diagrams. Many snapshots belong to one attempt.

### DATA DICTIONARY OF ASSESSMENT_ATTEMPT_ANSWERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| attempt_answer_id | PK, identity | BIGINT | No | Unique identifier for an attempt answer. |
| assessment_attempt_id | FK → ASSESSMENT_ATTEMPTS, NOT NULL, UNIQUE(assessment_attempt_id, attempt_question_id) | BIGINT | No | Attempt this answer belongs to. |
| attempt_question_id | FK → ASSESSMENT_ATTEMPT_QUESTIONS, NOT NULL | BIGINT | No | Snapshotted question being answered. |
| learner_answer | — | TEXT | Yes | Free-text answer (short answer, descriptive, sub-question JSON). |
| selected_choice_id | — | BIGINT | Yes | Choice id selected for multiple-choice items. |
| submitted_code | — | TEXT | Yes | Code submitted for programming items. |
| programming_language | — | VARCHAR(30) | Yes | Language of the submitted code. |
| diagram_submission_data | — | TEXT | Yes | Submitted diagram data for diagram items. |
| is_correct | — | BOOLEAN | Yes | Correctness set only by server-side scoring; null until scored or while pending manual evaluation. |
| earned_points | — | DECIMAL(5,2) | Yes | Points awarded by scoring. |
| pending_manual_evaluation | NOT NULL | BOOLEAN | No | Whether the answer awaits manual/AI evaluation. Defaults to false. |
| feedback | — | TEXT | Yes | AI grading feedback for descriptive/critical-thinking answers (learner-safe). |
| sub_answer_scores | — | TEXT | Yes | JSON array of per-sub-question AI scores for critical-thinking answers. |
| execution_result | — | TEXT | Yes | JSON Judge0 execution payload: code hash, mode, status, output, error, time/memory, per-test results. |
| diagram_grading_result | — | TEXT | Yes | JSON per-element (node/edge) grading breakdown from the diagram grading service. |
| answered_at | — | TIMESTAMP | Yes | Date and time the answer was first recorded. |
| last_saved_at | — | TIMESTAMP | Yes | Date and time the answer was last saved. |

The ASSESSMENT_ATTEMPT_ANSWERS table stores a learner's answer to one attempt question across all question types. Each attempt question has at most one answer per attempt.

### DATA DICTIONARY OF ASSESSMENT_ATTEMPT_EXECUTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| execution_id | PK, identity | BIGINT | No | Unique identifier for a code execution. |
| assessment_attempt_id | FK → ASSESSMENT_ATTEMPTS, NOT NULL | BIGINT | No | Attempt the execution belongs to. |
| attempt_question_id | FK → ASSESSMENT_ATTEMPT_QUESTIONS, NOT NULL | BIGINT | No | Programming item the code was run against. |
| mode | NOT NULL | VARCHAR(10) | No | Execution mode: RUN or CHECK. |
| language | — | VARCHAR(30) | Yes | Programming language used. |
| submitted_code | — | TEXT | Yes | Code that was executed. |
| status | NOT NULL | VARCHAR(30) | No | Execution state: UNAVAILABLE, QUEUED, RUNNING, COMPLETED, or ERROR. |
| passed_tests | — | INT | Yes | Number of test cases passed. |
| total_tests | — | INT | Yes | Total number of test cases run. |
| output | — | TEXT | Yes | Program output or error text. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the execution was triggered. |

The ASSESSMENT_ATTEMPT_EXECUTIONS table is the Run/Check history log of programming items, executed via Judge0. Many executions can belong to one attempt question.

---

## 6. PROGRESS AND GAMIFICATION

### DATA DICTIONARY OF ACTIVITY_TYPES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| activity_type_id | PK, identity | BIGINT | No | Unique identifier for an activity type. |
| activity_type_text | UNIQUE, NOT NULL | VARCHAR(50) | No | Name of the activity, such as lesson study, quiz, exam, or challenge. |

The ACTIVITY_TYPES table stores the classifications used for user activity records. Many activity-log entries can reference each activity type.

### DATA DICTIONARY OF ACTIVITY_LOGS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| log_id | PK, identity | BIGINT | No | Unique identifier for an activity-log entry. |
| user_id | FK → USERS | BIGINT | Yes | User who performed the activity. |
| activity_type_id | FK → ACTIVITY_TYPES | BIGINT | Yes | Type of activity performed. |
| occurred_at | NOT NULL | TIMESTAMP | No | Date and time the activity happened. |
| duration_seconds | — | INT | Yes | Duration of the activity in seconds. |

The ACTIVITY_LOGS table records every tracked user activity for streaks and analytics. Many logs belong to one user and one activity type.

### DATA DICTIONARY OF ACHIEVEMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| achievement_id | PK, identity | BIGINT | No | Unique identifier for an achievement. |
| title | UNIQUE, NOT NULL | VARCHAR(100) | No | Title of the achievement badge. |
| description | NOT NULL | TEXT | No | Description of how the achievement is earned. |
| image_key | NOT NULL | VARCHAR(255) | No | S3 key of the badge image. |

The ACHIEVEMENTS table stores the badge definitions of the platform. Many learners can earn each achievement through the LEARNER_ACHIEVEMENTS table.

### DATA DICTIONARY OF LEARNER_ACHIEVEMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who earned the achievement. |
| achievement_id | PK (composite), FK → ACHIEVEMENTS | BIGINT | No | Achievement that was earned. |
| earned_at | NOT NULL | TIMESTAMP | No | Date and time the achievement was earned. |

The LEARNER_ACHIEVEMENTS table is the junction between learners and achievements, recording when each badge was earned.

### DATA DICTIONARY OF LEARNER_COMPLETED_LESSONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who completed the lesson. |
| lesson_id | PK (composite), FK → LESSONS | BIGINT | No | Lesson that was completed. |
| completed_at | NOT NULL | TIMESTAMP | No | Date and time the lesson was completed. |

The LEARNER_COMPLETED_LESSONS table is the junction between learners and lessons, recording lesson completion for progress tracking.

### DATA DICTIONARY OF LEARNER_LESSON_MASTERY

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner whose mastery is tracked. |
| lesson_id | PK (composite), FK → LESSONS | BIGINT | No | Lesson being mastered. |
| mastery_probability | NOT NULL | DOUBLE PRECISION | No | BKT probability (0–1) that the learner has mastered the lesson. Defaults to 0. |
| mastery_level | NOT NULL | VARCHAR(20) | No | Banded level: WEAK, DEVELOPING, GOOD, or MASTERED. |
| last_updated | NOT NULL | TIMESTAMP | No | Date and time the mastery was last recomputed. |

The LEARNER_LESSON_MASTERY table stores the Bayesian Knowledge Tracing mastery estimate per learner per lesson. One row exists per learner–lesson pair.

### DATA DICTIONARY OF LEARNER_WEAK_AREAS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner whose weak area is tracked. |
| lesson_id | PK (composite), FK → LESSONS | BIGINT | No | Lesson identified as a weak area. |
| total_attempts | NOT NULL | INT | No | Total questions attempted for the lesson. |
| correct_count | NOT NULL | INT | No | Number of correct answers. |
| incorrect_count | NOT NULL | INT | No | Number of incorrect answers. |
| accuracy_rate | NOT NULL | DOUBLE PRECISION | No | Ratio of correct answers to attempts. |
| mastery_probability | — | DOUBLE PRECISION | Yes | Latest BKT mastery probability for the lesson. |
| weakness_level | — | VARCHAR(255) | Yes | Severity band: LOW, MODERATE, or HIGH. |
| last_updated | — | TIMESTAMP | Yes | Date and time the record was last recomputed. |

The LEARNER_WEAK_AREAS table stores per-lesson performance statistics used to surface a learner's weak areas. One row exists per learner–lesson pair.

---

## 7. ENROLLMENT AND ORDERS (B2C)

### DATA DICTIONARY OF LEARNER_ORDERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| order_id | PK, identity | BIGINT | No | Unique identifier for a purchase order. |
| order_number | UNIQUE, NOT NULL | VARCHAR(50) | No | Human-readable order number. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who placed the order. |
| ordered_at | NOT NULL | TIMESTAMP | No | Date and time the order was placed. |
| subtotal | NOT NULL | DECIMAL(10,2) | No | Sum of item prices before discount. |
| discount_amount | NOT NULL | DECIMAL(10,2) | No | Discount applied to the order. Defaults to 0. |
| total_amount | NOT NULL | DECIMAL(10,2) | No | Final amount charged. |
| payment_reference | — | VARCHAR(100) | Yes | External payment reference number. |
| paid_at | — | TIMESTAMP | Yes | Date and time payment was confirmed. |
| status | NOT NULL | VARCHAR(20) | No | Order state: pending, completed, cancelled, or refunded. Defaults to pending. |
| idempotency_key | UNIQUE | VARCHAR(100) | Yes | Key preventing duplicate purchase transactions from retried requests. |

The LEARNER_ORDERS table stores certification purchase orders of individual learners. One order contains many order details.

### DATA DICTIONARY OF LEARNER_ORDER_DETAILS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| order_detail_id | PK, identity | BIGINT | No | Unique identifier for an order line item. |
| order_id | FK → LEARNER_ORDERS, NOT NULL | BIGINT | No | Order the line item belongs to. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification being purchased. |
| price | NOT NULL | DECIMAL(10,2) | No | Price of the certification at purchase time. |

The LEARNER_ORDER_DETAILS table stores the line items of a purchase order. Many details belong to one order, each referencing one certification.

### DATA DICTIONARY OF LEARNER_CERTIFICATIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_certification_id | PK, identity | BIGINT | No | Unique identifier for an enrollment. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Enrolled learner. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification enrolled in. |
| order_detail_id | FK → LEARNER_ORDER_DETAILS, UNIQUE, NOT NULL | BIGINT | No | Order line item that paid for this enrollment (one-to-one). |
| enrolled_at | NOT NULL | TIMESTAMP | No | Date and time of enrollment. |
| status | NOT NULL | VARCHAR(20) | No | Enrollment state: active, expired, or revoked. Defaults to active. |
| diagnostic_completed_at | — | TIMESTAMP | Yes | Set once the learner submits the certification's diagnostic assessment. |
| diagnostic_attempt_id | — | BIGINT | Yes | Attempt id of the completed diagnostic. |
| last_accessed_at | — | TIMESTAMP | Yes | Date and time the learner last opened the certification. |

The LEARNER_CERTIFICATIONS table stores learner enrollments in certifications. Each enrollment is backed by exactly one order detail and is referenced by assessment attempts.

### DATA DICTIONARY OF ORGANIZATION_CERTIFICATION_LEARNERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| org_cert_learner_id | PK, identity | BIGINT | No | Unique identifier for an organization-sponsored enrollment. |
| org_cert_id | FK → ORGANIZATION_CERTIFICATES, NOT NULL, UNIQUE(org_cert_id, learner_id) | BIGINT | No | Organization allocation the learner occupies a slot in. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner assigned to the slot. |
| assigned_at | NOT NULL | TIMESTAMP | No | Date and time the learner was assigned. |
| progress_percentage | NOT NULL | DECIMAL(5,2) | No | Learner's progress in the sponsored certification. Defaults to 0. |
| completed_at | — | TIMESTAMP | Yes | Date and time the learner completed the program. |
| status | NOT NULL | VARCHAR(20) | No | Slot state: active, completed, or revoked. Defaults to active. |

The ORGANIZATION_CERTIFICATION_LEARNERS table links learners to the certification slots purchased by their organization. Each learner can occupy one slot per organization certificate.

---

## 8. BILLING AND SUBSCRIPTIONS

### DATA DICTIONARY OF SUBSCRIPTION_PLANS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| subscription_plan_id | PK, identity | BIGINT | No | Unique identifier for a plan. |
| plan_code | UNIQUE, NOT NULL | VARCHAR(50) | No | Machine-readable code of the plan. |
| plan_name | NOT NULL | VARCHAR(150) | No | Display name of the plan. |
| customer_type | NOT NULL | VARCHAR(20) | No | Who the plan targets: INDIVIDUAL (B2C) or INSTITUTION (B2B). |
| description | — | TEXT | Yes | Marketing description of the plan. |
| billing_interval | NOT NULL | VARCHAR(20) | No | Billing cycle: NONE, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, or CUSTOM. Defaults to NONE. |
| amount | NOT NULL | DECIMAL(12,2) | No | Price per billing interval. Defaults to 0. |
| currency | NOT NULL | VARCHAR(3) | No | ISO currency code. Defaults to PHP. |
| is_free | NOT NULL | BOOLEAN | No | Whether the plan is free. Defaults to false. |
| is_custom_pricing | NOT NULL | BOOLEAN | No | Whether pricing is negotiated per contract. Defaults to false. |
| status | NOT NULL | VARCHAR(20) | No | Plan availability state. Defaults to ACTIVE. |
| display_order | NOT NULL | INT | No | Ordering of the plan in pricing pages. Defaults to 0. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the plan was created. |
| updated_at | NOT NULL | TIMESTAMP | No | Date and time the plan was last updated. |

The SUBSCRIPTION_PLANS table stores purchasable B2C and B2B plans. One plan owns many entitlements and is referenced by learner subscriptions and institutional licenses.

### DATA DICTIONARY OF PLAN_ENTITLEMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| plan_entitlement_id | PK, identity | BIGINT | No | Unique identifier for an entitlement. |
| subscription_plan_id | FK → SUBSCRIPTION_PLANS, NOT NULL, UNIQUE(subscription_plan_id, entitlement_code) | BIGINT | No | Plan granting the entitlement. |
| entitlement_code | NOT NULL | VARCHAR(60) | No | Code of the feature or limit (e.g. SEAT_LIMIT). |
| enabled | NOT NULL | BOOLEAN | No | Whether the entitlement is switched on. Defaults to true. |
| limit_value | — | INT | Yes | Capacity limit value when the entitlement is a limit (e.g. 75 seats). |
| configuration_json | — | TEXT | Yes | Optional JSON configuration for the entitlement. |

The PLAN_ENTITLEMENTS table stores the feature flags and capacity limits granted by each plan. Many entitlements belong to one subscription plan.

### DATA DICTIONARY OF LEARNER_SUBSCRIPTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_subscription_id | PK, identity | BIGINT | No | Unique identifier for a subscription. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Subscribing learner. |
| subscription_plan_id | FK → SUBSCRIPTION_PLANS, NOT NULL | BIGINT | No | Individual plan subscribed to. |
| provider | — | VARCHAR(30) | Yes | Payment provider handling the subscription. |
| provider_customer_id | — | VARCHAR(100) | Yes | Customer id on the payment provider. |
| provider_subscription_id | — | VARCHAR(100) | Yes | Subscription id on the payment provider. |
| status | NOT NULL | VARCHAR(20) | No | Lifecycle: PENDING, TRIALING, ACTIVE, PAST_DUE, SUSPENDED, CANCELED, EXPIRED, or PAYMENT_FAILED. Defaults to PENDING. |
| started_at | — | TIMESTAMP | Yes | Date and time the subscription started. |
| current_period_start | — | TIMESTAMP | Yes | Start of the current billing period. |
| current_period_end | — | TIMESTAMP | Yes | End of the current billing period. |
| cancel_at_period_end | NOT NULL | BOOLEAN | No | Whether the subscription cancels at the period end. Defaults to false. |
| canceled_at | — | TIMESTAMP | Yes | Date and time cancellation was requested. |
| ended_at | — | TIMESTAMP | Yes | Date and time the subscription fully ended. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the record was created. |
| updated_at | NOT NULL | TIMESTAMP | No | Date and time the record was last updated. |

The LEARNER_SUBSCRIPTIONS table stores a learner's personal (B2C) subscription to an individual plan. Many subscriptions can reference one plan.

### DATA DICTIONARY OF INSTITUTIONAL_LICENSES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institutional_license_id | PK, identity | BIGINT | No | Unique identifier for a license. |
| institution_id | FK → INSTITUTIONS, NOT NULL | BIGINT | No | Institution holding the license. |
| subscription_plan_id | FK → SUBSCRIPTION_PLANS, NOT NULL | BIGINT | No | Institution plan licensed. |
| provider | — | VARCHAR(30) | Yes | Payment provider handling the license. |
| provider_customer_id | — | VARCHAR(100) | Yes | Customer id on the payment provider. |
| provider_subscription_id | — | VARCHAR(100) | Yes | Subscription id on the payment provider. |
| contract_number | — | VARCHAR(60) | Yes | Internal contract reference number. |
| license_status | NOT NULL | VARCHAR(20) | No | Lifecycle: PENDING, TRIALING, ACTIVE, PAST_DUE, SUSPENDED, CANCELED, EXPIRED, or PAYMENT_FAILED. Defaults to PENDING. |
| started_at | — | TIMESTAMP | Yes | Date and time the license started. |
| current_period_start | — | TIMESTAMP | Yes | Start of the current contract period. |
| current_period_end | — | TIMESTAMP | Yes | End of the current contract period. |
| cancel_at_period_end | NOT NULL | BOOLEAN | No | Whether the license cancels at the period end. Defaults to false. |
| canceled_at | — | TIMESTAMP | Yes | Date and time cancellation was requested. |
| ended_at | — | TIMESTAMP | Yes | Date and time the license fully ended. |
| custom_seat_limit | — | INT | Yes | Contract override of the plan's seat limit; null uses the plan's limit. |
| custom_group_limit | — | INT | Yes | Contract override of the plan's group limit. |
| custom_authority_limit | — | INT | Yes | Contract override of the plan's authority limit. |
| custom_certification_limit | — | INT | Yes | Contract override of the plan's certification limit. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the record was created. |
| updated_at | NOT NULL | TIMESTAMP | No | Date and time the record was last updated. |

The INSTITUTIONAL_LICENSES table stores an institution's (B2B) license to an institution plan, with optional per-contract limit overrides. Many licenses can reference one plan.

---

## 9. ORGANIZATIONS AND PARTNERSHIPS (B2B)

### DATA DICTIONARY OF INSTITUTIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_id | PK, identity | BIGINT | No | Unique identifier for an institution. |
| institution_name | UNIQUE, NOT NULL | VARCHAR(150) | No | Registered name of the organization. |
| organization_type | NOT NULL | VARCHAR(50) | No | Kind of organization: school, university, review_center, company, government, training_center, or other. |
| industry | NOT NULL | VARCHAR(100) | No | Industry the organization operates in. |
| primary_contact_name | NOT NULL | VARCHAR(100) | No | Name of the primary contact person. |
| primary_contact_email | NOT NULL | VARCHAR(254) | No | E-mail of the primary contact person. |
| primary_contact_phone | — | VARCHAR(30) | Yes | Phone number of the primary contact person. |
| is_verified | NOT NULL | BOOLEAN | No | Whether the organization has passed verification. Defaults to false. |
| address | — | TEXT | Yes | Physical address of the organization. |
| joined_at | — | TIMESTAMP | Yes | Date and time the institution was onboarded. |

The INSTITUTIONS table stores partner organizations. One institution owns members, verification documents, certificates (slot allocations), groups, invoices, and licenses.

### DATA DICTIONARY OF INSTITUTION_MEMBERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_member_id | PK, identity | BIGINT | No | Unique identifier for a membership. |
| institution_id | FK → INSTITUTIONS, NOT NULL, UNIQUE(institution_id, user_id) | BIGINT | No | Institution the member belongs to. |
| user_id | FK → USERS, NOT NULL | BIGINT | No | User account of the member. |
| member_role | NOT NULL | VARCHAR(20) | No | Role in the organization: owner, manager, or staff. Defaults to manager. |
| is_primary_contact | NOT NULL | BOOLEAN | No | Whether this member is the primary contact. Defaults to false. |
| joined_at | NOT NULL | TIMESTAMP | No | Date and time the member joined the institution. |

The INSTITUTION_MEMBERS table links user accounts to institutions with a role. A user can belong to an institution only once.

### DATA DICTIONARY OF INSTITUTION_VERIFICATION_DOCUMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_document_id | PK, identity | BIGINT | No | Unique identifier for a verification document. |
| institution_id | FK → INSTITUTIONS, NOT NULL | BIGINT | No | Institution the document belongs to. |
| document_type | NOT NULL | VARCHAR(50) | No | Kind of document (e.g. business permit, SEC registration). |
| file_key | NOT NULL | VARCHAR(500) | No | S3 key of the uploaded file. |
| uploaded_at | NOT NULL | TIMESTAMP | No | Date and time the document was uploaded. |

The INSTITUTION_VERIFICATION_DOCUMENTS table stores the files submitted to verify an organization. Many documents belong to one institution.

### DATA DICTIONARY OF ORGANIZATION_CERTIFICATES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| org_cert_id | PK, identity | BIGINT | No | Unique identifier for an organization's certification allocation. |
| institution_id | FK → INSTITUTIONS, NOT NULL | BIGINT | No | Institution that purchased the allocation. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification the slots grant access to. |
| total_slots | NOT NULL | INT | No | Total learner slots purchased. |
| used_slots | NOT NULL | INT | No | Slots already consumed by learners. Defaults to 0. |
| remaining_slots | Read-only (DB-computed) | INT | Yes | Remaining slots; not written by the application. |
| access_start_date | NOT NULL | DATE | No | First day learners can access the certification. |
| access_expiry_date | NOT NULL | DATE | No | Last day of access. |
| status | NOT NULL | VARCHAR(20) | No | Allocation state: pending, active, expired, suspended, or cancelled. Defaults to active. |
| version | Optimistic lock (@Version) | BIGINT | Yes | Version counter guarding concurrent slot reservation so simultaneous invitation batches cannot oversubscribe. |

The ORGANIZATION_CERTIFICATES table stores the certification slot allocations an institution has purchased. One allocation is referenced by learner invitations, sponsored enrollments, groups, and renewal requests.

### DATA DICTIONARY OF PARTNERSHIP_REQUESTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| request_id | PK, identity | BIGINT | No | Unique identifier for a partnership request. |
| reference_number | UNIQUE, indexed | VARCHAR(32) | Yes | Public reference number returned to the requester for status lookup. |
| institution_id | FK → INSTITUTIONS | BIGINT | Yes | Null until the request is approved and an institution record is created. |
| organization_name | — | VARCHAR(150) | Yes | Organization name captured on the public request. |
| organization_email | Indexed | VARCHAR(254) | Yes | Organization e-mail captured on the public request. |
| contact_person_name | — | VARCHAR(150) | Yes | Contact person named on the request. |
| contact_number | — | VARCHAR(40) | Yes | Contact phone number on the request. |
| organization_address | — | TEXT | Yes | Organization address on the request. |
| business_description | — | TEXT | Yes | Description of the requesting business. |
| submitted_at | NOT NULL | TIMESTAMP | No | Date and time the request was submitted. |
| status | NOT NULL, indexed | VARCHAR(25) | No | Request state: PENDING, UNDER_REVIEW, MEETING_SCHEDULED, APPROVED, REJECTED, or CANCELLED. Defaults to PENDING. |
| reviewed_at | — | TIMESTAMP | Yes | Date and time an admin reviewed the request. |
| reviewed_by | — | VARCHAR(150) | Yes | Name of the admin who reviewed the request. |
| admin_remarks | — | TEXT | Yes | Admin notes on approval or rejection. |
| idempotency_key | UNIQUE | VARCHAR(64) | Yes | Prevents duplicate submissions of the same request. |

The PARTNERSHIP_REQUESTS table stores public partnership applications from organizations. One request owns many request items and meetings, and may result in one institution.

### DATA DICTIONARY OF PARTNERSHIP_REQUEST_ITEMS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| partnership_request_item_id | PK, identity | BIGINT | No | Unique identifier for a request line item. |
| request_id | FK → PARTNERSHIP_REQUESTS, NOT NULL | BIGINT | No | Partnership request the item belongs to. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification being requested. |
| slots | NOT NULL | INT | No | Number of learner slots requested. |
| requested_access_start_date | — | DATE | Yes | Requested start of access; the admin sets the real window on approval. |
| requested_access_end_date | — | DATE | Yes | Requested end of access. |

The PARTNERSHIP_REQUEST_ITEMS table stores the certifications and slot counts requested in a partnership application. Many items belong to one request.

### DATA DICTIONARY OF PARTNERSHIP_MEETINGS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| meeting_id | PK, identity | BIGINT | No | Unique identifier for a meeting. |
| request_id | FK → PARTNERSHIP_REQUESTS, NOT NULL | BIGINT | No | Partnership request the meeting is for. |
| scheduled_at | NOT NULL | TIMESTAMP | No | Date and time the meeting is scheduled. |
| meeting_link | — | VARCHAR(500) | Yes | Video conference link for the meeting. |
| status | NOT NULL | VARCHAR(20) | No | Meeting state: scheduled, completed, cancelled, or no_show. Defaults to scheduled. |
| outcome | — | VARCHAR(20) | Yes | Result of the meeting: approved, rejected, or cancelled. |

The PARTNERSHIP_MEETINGS table stores the meetings scheduled to evaluate a partnership request. Many meetings can belong to one request.

### DATA DICTIONARY OF INSTITUTION_CERTIFICATION_RENEWAL_REQUESTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| renewal_request_id | PK, identity | BIGINT | No | Unique identifier for a renewal request. |
| org_cert_id | FK → ORGANIZATION_CERTIFICATES, NOT NULL | BIGINT | No | Slot allocation being renewed. |
| requested_validity_months | NOT NULL | INT | No | Number of months of extension requested. |
| requested_at | NOT NULL | TIMESTAMP | No | Date and time the renewal was requested. |
| status | NOT NULL | VARCHAR(20) | No | Request state: pending, approved, rejected, or cancelled. Defaults to pending. |
| reviewed_at | — | TIMESTAMP | Yes | Date and time an admin reviewed the request. |

The INSTITUTION_CERTIFICATION_RENEWAL_REQUESTS table stores requests to extend an organization's certification access. Many renewal requests can belong to one organization certificate.

### DATA DICTIONARY OF INSTITUTION_INVOICES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_invoice_id | PK, identity | BIGINT | No | Unique identifier for an invoice. |
| institution_id | FK → INSTITUTIONS, NOT NULL | BIGINT | No | Institution being billed. |
| invoice_number | UNIQUE, NOT NULL | VARCHAR(50) | No | Human-readable invoice number. |
| invoice_type | NOT NULL | VARCHAR(30) | No | Reason for the invoice: initial_access or renewal. |
| partnership_request_id | FK → PARTNERSHIP_REQUESTS | BIGINT | Yes | Approved partnership request that generated the invoice. |
| renewal_request_id | FK → INSTITUTION_CERTIFICATION_RENEWAL_REQUESTS | BIGINT | Yes | Approved renewal request that generated the invoice. |
| bill_to_name | NOT NULL | VARCHAR(150) | No | Billing contact name. |
| bill_to_email | NOT NULL | VARCHAR(254) | No | Billing contact e-mail. |
| subtotal | NOT NULL | DECIMAL(10,2) | No | Sum of line items before discount and tax. |
| discount_amount | NOT NULL | DECIMAL(10,2) | No | Discount applied. Defaults to 0. |
| tax_rate | NOT NULL | DECIMAL(5,2) | No | Tax rate applied. Defaults to 0. |
| tax_amount | NOT NULL | DECIMAL(10,2) | No | Tax amount charged. Defaults to 0. |
| total_amount | NOT NULL | DECIMAL(10,2) | No | Final amount due. |
| issued_at | NOT NULL | TIMESTAMP | No | Date and time the invoice was issued. |
| payment_reference | — | VARCHAR(100) | Yes | Payment reference submitted by the institution. |
| payment_proof_key | — | VARCHAR(500) | Yes | S3 key of the uploaded payment proof. |
| verified_by_user_id | FK → USERS | BIGINT | Yes | Admin who verified the payment. |
| paid_at | — | TIMESTAMP | Yes | Date and time payment was confirmed. |
| status | NOT NULL | VARCHAR(30) | No | Invoice state: draft, issued, payment_submitted, paid, rejected, cancelled, or VOID. Defaults to issued. |

The INSTITUTION_INVOICES table stores B2B invoices for initial access and renewals. One invoice contains many invoice items and traces back to the request that produced it.

### DATA DICTIONARY OF INSTITUTION_INVOICE_ITEMS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_invoice_item_id | PK, identity | BIGINT | No | Unique identifier for an invoice line item. |
| institution_invoice_id | FK → INSTITUTION_INVOICES, NOT NULL | BIGINT | No | Invoice the line item belongs to. |
| certification_id | FK → CERTIFICATIONS, NOT NULL | BIGINT | No | Certification being billed. |
| learner_slots | — | INT | Yes | Number of learner slots billed. |
| validity_months | NOT NULL | INT | No | Access validity in months being billed. |

The INSTITUTION_INVOICE_ITEMS table stores the line items of an institution invoice. Many items belong to one invoice, each referencing one certification.

### DATA DICTIONARY OF LEARNER_INVITATIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| invitation_id | PK, identity | BIGINT | No | Unique identifier for an invitation. |
| org_cert_id | FK → ORGANIZATION_CERTIFICATES, NOT NULL | BIGINT | No | Slot allocation the invitation reserves a slot in. |
| learner_id | FK → LEARNERS | BIGINT | Yes | Learner account, once the invitee has one. |
| email | NOT NULL | VARCHAR(254) | No | E-mail address the invitation was sent to. |
| token_hash | UNIQUE, NOT NULL | VARCHAR(255) | No | Hashed acceptance token of the invitation link. |
| sent_at | NOT NULL | TIMESTAMP | No | Date and time the invitation was sent. |
| expires_at | NOT NULL | TIMESTAMP | No | Date and time the invitation expires. |
| accepted_at | — | TIMESTAMP | Yes | Date and time the invitation was accepted. |
| status | NOT NULL | VARCHAR(20) | No | Invitation state: PENDING, ACCEPTED, EXPIRED, or REVOKED. Defaults to PENDING. |

The LEARNER_INVITATIONS table stores invitations sent by organizations to enroll learners into sponsored certification slots. Many invitations belong to one organization certificate.

---

## 10. INSTITUTION GROUPS

### DATA DICTIONARY OF INSTITUTION_GROUPS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_group_id | PK, identity | BIGINT | No | Unique identifier for a group. |
| institution_id | FK → INSTITUTIONS, NOT NULL | BIGINT | No | Institution that owns the group. |
| org_cert_id | FK → ORGANIZATION_CERTIFICATES, NOT NULL | BIGINT | No | Certification allocation the group is scoped to. |
| group_name | NOT NULL | VARCHAR(150) | No | Name of the group. |
| group_description | — | VARCHAR(500) | Yes | Description of the group. |
| created_by | FK → USERS, NOT NULL | BIGINT | No | User who created the group. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the group was created. |
| status | NOT NULL | VARCHAR(20) | No | Group state: active or archived. Defaults to active. |

The INSTITUTION_GROUPS table stores learner groupings inside an institution's certification allocation. One group has many authorities and many assignees.

### DATA DICTIONARY OF INSTITUTION_GROUP_AUTHORITIES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_group_authority_id | PK, identity | BIGINT | No | Unique identifier for an authority assignment. |
| institution_group_id | FK → INSTITUTION_GROUPS, NOT NULL, UNIQUE(institution_group_id, user_id) | BIGINT | No | Group being managed. |
| user_id | FK → USERS, NOT NULL | BIGINT | No | User granted authority over the group. |
| assigned_by | FK → USERS, NOT NULL | BIGINT | No | User who granted the authority. |
| assigned_at | NOT NULL | TIMESTAMP | No | Date and time the authority was granted. |
| status | NOT NULL | VARCHAR(20) | No | Assignment state: active or archived. Defaults to active. |
| removed_at | — | TIMESTAMP | Yes | Date and time the authority was removed. |

The INSTITUTION_GROUP_AUTHORITIES table stores the users (e.g. instructors) authorized to manage a group. A user can be an authority of a group only once.

### DATA DICTIONARY OF INSTITUTION_GROUP_ASSIGNEES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| institution_group_assignee_id | PK, identity | BIGINT | No | Unique identifier for a group membership. |
| institution_group_id | FK → INSTITUTION_GROUPS, NOT NULL, UNIQUE(institution_group_id, org_cert_learner_id) | BIGINT | No | Group the learner is assigned to. |
| org_cert_learner_id | FK → ORGANIZATION_CERTIFICATION_LEARNERS, NOT NULL | BIGINT | No | Sponsored enrollment placed in the group. |
| assigned_by | FK → USERS, NOT NULL | BIGINT | No | User who assigned the learner. |
| assigned_at | NOT NULL | TIMESTAMP | No | Date and time the learner was assigned. |
| status | NOT NULL | VARCHAR(20) | No | Membership state: active or archived. Defaults to active. |
| removed_at | — | TIMESTAMP | Yes | Date and time the learner was removed from the group. |

The INSTITUTION_GROUP_ASSIGNEES table places sponsored learners into institution groups. A sponsored enrollment can appear in a group only once.

---

## 11. COMMUNITY

### DATA DICTIONARY OF COMMUNITY_CIRCLES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| circle_id | PK, identity | BIGINT | No | Unique identifier for a study circle. |
| owner_learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who created and owns the circle. |
| name | NOT NULL | VARCHAR(120) | No | Name of the circle. |
| description | NOT NULL | VARCHAR(1000) | No | Description of the circle. |
| topic | NOT NULL | VARCHAR(120) | No | Topic the circle focuses on. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the circle was created. |

The COMMUNITY_CIRCLES table stores learner-created study circles. One circle has many members and many posts.

### DATA DICTIONARY OF COMMUNITY_CIRCLE_MEMBERS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| circle_id | PK (composite), FK → COMMUNITY_CIRCLES | BIGINT | No | Circle the learner joined. |
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who joined the circle. |
| joined_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the learner joined. |

The COMMUNITY_CIRCLE_MEMBERS table is the junction between circles and learners, recording circle membership.

### DATA DICTIONARY OF COMMUNITY_POSTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| post_id | PK, identity | BIGINT | No | Unique identifier for a post. |
| author_learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who authored the post. |
| circle_id | FK → COMMUNITY_CIRCLES | BIGINT | Yes | Circle the post belongs to; null for public feed posts. |
| post_type | NOT NULL, CHECK | VARCHAR(24) | No | Kind of post: discussion, quizzes, notes, docx, or circle. |
| title | NOT NULL | VARCHAR(180) | No | Title of the post. |
| body | NOT NULL | TEXT | No | Body content of the post. |
| attachment_name | — | VARCHAR(255) | Yes | Original filename of the attachment. |
| attachment_type | — | VARCHAR(16) | Yes | File type of the attachment (pdf, docx). |
| attachment_key | — | VARCHAR(500) | Yes | S3 key of the uploaded attachment; null when the post has none. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the post was created. |
| updated_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the post was last edited. |

The COMMUNITY_POSTS table stores learner posts in the community feed and inside circles. One post has many comments, likes, and saves.

### DATA DICTIONARY OF COMMUNITY_COMMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| comment_id | PK, identity | BIGINT | No | Unique identifier for a comment. |
| post_id | FK → COMMUNITY_POSTS, NOT NULL | BIGINT | No | Post being commented on. |
| author_learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who wrote the comment. |
| parent_comment_id | FK → COMMUNITY_COMMENTS (self) | BIGINT | Yes | Parent comment when this is a reply. |
| body | NOT NULL | VARCHAR(2000) | No | Text of the comment. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the comment was created. |
| updated_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the comment was last edited. |

The COMMUNITY_COMMENTS table stores comments and threaded replies on posts. Many comments belong to one post, and a comment may parent many replies.

### DATA DICTIONARY OF COMMUNITY_POST_LIKES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| post_id | PK (composite), FK → COMMUNITY_POSTS | BIGINT | No | Post that was liked. |
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who liked the post. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the like was made. |

The COMMUNITY_POST_LIKES table is the junction between posts and learners recording likes; a learner can like a post only once.

### DATA DICTIONARY OF COMMUNITY_SAVED_POSTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| post_id | PK (composite), FK → COMMUNITY_POSTS | BIGINT | No | Post that was saved. |
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who saved the post. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the post was saved. |

The COMMUNITY_SAVED_POSTS table is the junction between posts and learners recording bookmarks; a learner can save a post only once.

---

## 12. LEARNING TOOLS

### DATA DICTIONARY OF LEARNER_LIBRARY_ITEMS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| library_item_id | PK, identity | BIGINT | No | Unique identifier for a library item. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner who owns the item. |
| certification_id | FK → CERTIFICATIONS | BIGINT | Yes | Certification the item is tagged to. |
| lesson_id | FK → LESSONS | BIGINT | Yes | Lesson the item is tagged to. |
| item_type | NOT NULL, CHECK | VARCHAR(24) | No | Kind of item: quiz, flashcard, file, link, or note. |
| title | NOT NULL | VARCHAR(180) | No | Title of the library item. |
| description | — | VARCHAR(1000) | Yes | Description or note body of the item. |
| resource_url | — | VARCHAR(1000) | Yes | A pasted URL for link items, or a raw S3 key for file items. |
| created_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the item was created. |
| updated_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the item was last updated. |

The LEARNER_LIBRARY_ITEMS table stores a learner's personal study library (quizzes, flashcards, files, links, notes). Many items belong to one learner and may reference a certification or lesson.

### DATA DICTIONARY OF LEARNER_MISTAKE_REVIEWS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| learner_id | PK (composite), FK → LEARNERS | BIGINT | No | Learner who reviewed the mistake. |
| source_question_id | PK (composite), FK → QUESTIONS | BIGINT | No | Question the mistake was made on. |
| reviewed_at | NOT NULL | TIMESTAMP WITH TIME ZONE | No | Date and time the mistake was marked as reviewed. |

The LEARNER_MISTAKE_REVIEWS table marks one mistake (learner + source question) as reviewed in the mistakes bank. It is a junction between learners and questions.

---

## 13. AI KNOWLEDGE BASE

### DATA DICTIONARY OF KNOWLEDGE_DOCUMENTS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| knowledge_document_id | PK, identity | BIGINT | No | Unique identifier for an ingested document. |
| filename | NOT NULL | VARCHAR(255) | No | Stored filename of the document. |
| original_filename | NOT NULL | VARCHAR(255) | No | Filename as uploaded by the admin. |
| content_type | NOT NULL | VARCHAR(255) | No | MIME type of the document (PDF, DOCX). |
| file_size | — | BIGINT | Yes | Size of the file in bytes. |
| s3_key | — | VARCHAR(255) | Yes | S3 key of the stored file. |
| chunk_count | — | INT | Yes | Number of text chunks embedded from the document. |
| status | NOT NULL | VARCHAR(255) | No | Ingestion state: PROCESSING, READY, or FAILED. Defaults to PROCESSING. |
| uploaded_at | NOT NULL | TIMESTAMP | No | Date and time the document was uploaded. |
| processed_at | — | TIMESTAMP | Yes | Date and time ingestion finished. |
| certification_id | — | BIGINT | Yes | Certification the document's knowledge belongs to. |
| use_case | NOT NULL | VARCHAR(255) | No | What the document is used for in AI generation: LESSON or QUESTION. Defaults to LESSON. |

The KNOWLEDGE_DOCUMENTS table stores reference documents ingested for AI lesson and question generation (RAG). One document owns many extracted images and many embedded text chunks.

### DATA DICTIONARY OF KNOWLEDGE_DOCUMENT_IMAGES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| knowledge_document_image_id | PK, identity | BIGINT | No | Unique identifier for an extracted image. |
| knowledge_document_id | FK → KNOWLEDGE_DOCUMENTS, NOT NULL | BIGINT | No | Document the image was extracted from. |
| image_key | UNIQUE, NOT NULL | VARCHAR(255) | No | S3 key of the image; the same identifier saved as a question or choice image key. |
| content_type | — | VARCHAR(100) | Yes | MIME type of the image. |
| page_number | — | INT | Yes | Page the image was found on. |
| order_in_page | — | INT | Yes | Position of the image within its page. |
| nearby_text | — | TEXT | Yes | Short text captured near the image at extraction time (caption/context for the AI prompt). |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the image record was created. |

The KNOWLEDGE_DOCUMENT_IMAGES table stores images extracted from ingested documents during ingestion. Many images belong to one knowledge document; the images are linked from text-chunk metadata, never embedded.

---

## 14. BKT INTEGRATION

### DATA DICTIONARY OF BKT_EVENT_OUTBOX

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| id | PK, identity | BIGINT | No | Unique identifier for an outbox row. |
| event_id | UNIQUE, NOT NULL | VARCHAR(200) | No | Deterministic identity (attempt + attempt-question + grade version) so re-delivery never duplicates mastery evidence. |
| batch_id | — | VARCHAR(120) | Yes | Groups every event produced by one submitted attempt. |
| learner_id | NOT NULL | BIGINT | No | Learner the mastery evidence belongs to. |
| certification_id | — | BIGINT | Yes | Certification context of the event. |
| exam_id | — | BIGINT | Yes | Exam context of the event. |
| exam_result_id | — | BIGINT | Yes | Attempt id used as the stable result grouping for reconciliation. |
| attempt_no | — | INT | Yes | Attempt number of the source submission. |
| event_type | NOT NULL | VARCHAR(40) | No | Kind of event. Defaults to MASTERY. |
| payload_json | NOT NULL | TEXT | No | Serialized mastery event forwarded verbatim to the FastAPI BKT service. |
| status | NOT NULL | VARCHAR(20) | No | Delivery state: PENDING, PROCESSING, PROCESSED, FAILED, or DEAD_LETTER. Defaults to PENDING. |
| retry_count | NOT NULL | INT | No | Number of delivery retries so far. Defaults to 0. |
| next_retry_at | — | TIMESTAMP | Yes | Earliest time the next retry may run (backoff). |
| locked_at | — | TIMESTAMP | Yes | Time the row was claimed by a dispatcher. |
| locked_by | — | VARCHAR(100) | Yes | Identifier of the dispatcher instance holding the row. |
| last_error | — | TEXT | Yes | Last delivery error message. |
| created_at | NOT NULL | TIMESTAMP | No | Date and time the event was enqueued. |
| processed_at | — | TIMESTAMP | Yes | Date and time delivery succeeded. |

The BKT_EVENT_OUTBOX table stores durable mastery events awaiting delivery to the FastAPI BKT service. Rows are inserted inside the assessment submission transaction and consumed asynchronously by the dispatcher.

---

## 15. CHALLENGE MODE

### DATA DICTIONARY OF CHALLENGE_MODES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| challenge_mode_id | PK, identity | BIGINT | No | Unique identifier for a challenge mode. |
| name | UNIQUE, NOT NULL | VARCHAR(100) | No | Name of the challenge mode. |
| description | NOT NULL | TEXT | No | Description of the challenge rules. |
| is_timed | NOT NULL | BOOLEAN | No | Whether the mode has a time limit. Defaults to false. |

The CHALLENGE_MODES table stores the game-mode definitions of the challenge feature. One mode has many sessions and many industry tags.

### DATA DICTIONARY OF CHALLENGE_MODE_INDUSTRIES

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| challenge_mode_industry_id | PK, identity | BIGINT | No | Unique identifier for a mode–industry link. |
| industry | NOT NULL | VARCHAR(100) | No | Industry the challenge mode applies to. |
| challenge_mode_id | FK → CHALLENGE_MODES, NOT NULL | BIGINT | No | Challenge mode being tagged. |

The CHALLENGE_MODE_INDUSTRIES table tags challenge modes with the industries they apply to. Many industry tags belong to one challenge mode.

### DATA DICTIONARY OF CHALLENGE_SESSIONS

| Field Name | Constraints | Data Type | Allow Nulls | Description |
|---|---|---|---|---|
| challenge_session_id | PK, identity | BIGINT | No | Unique identifier for a challenge session. |
| challenge_mode_id | FK → CHALLENGE_MODES, NOT NULL | BIGINT | No | Mode being played. |
| learner_id | FK → LEARNERS, NOT NULL | BIGINT | No | Learner playing the session. |
| started_at | NOT NULL | TIMESTAMP | No | Date and time the session started. |
| ended_at | — | TIMESTAMP | Yes | Date and time the session ended. |
| score | — | DECIMAL(5,2) | Yes | Final score of the session. |
| status | NOT NULL | VARCHAR(20) | No | Session state: in_progress, passed, failed, or abandoned. Defaults to in_progress. |

The CHALLENGE_SESSIONS table stores each learner's play-through of a challenge mode. Many sessions belong to one learner and one challenge mode.
