-- The real certification exam's shape, as researched by the curriculum
-- planning agent: how many items the official paper has, which question types
-- it uses, and any notes on sections/weighting/time limit.
--
-- Needed because a mock exam has to imitate a specific paper rather than
-- sample the syllabus generically -- TOPCIT mixes MCQ, short-answer,
-- descriptive, programming and diagramming across 100 items, while many
-- certifications are MCQ-only. The planner already produced this and the mock
-- exam generator already consumed it, but it lived only in the LangGraph
-- checkpoint and was discarded when the run finished. That meant the admin UI
-- could not show what the mock is modelled on, and regenerating a mock exam
-- later required re-planning the whole curriculum to recover the numbers.
--
-- Nullable with no default: certifications created before this, and any run
-- where the planner could not determine the exam's structure, legitimately
-- have nothing to record. Readers must treat NULL as "unknown" and fall back
-- to the configured mock_exam_questions.
ALTER TABLE certifications
    ADD COLUMN exam_structure JSONB;

COMMENT ON COLUMN certifications.exam_structure IS
    'AI-researched shape of the real exam: {total_items, question_types[], notes}. NULL means unknown.';
