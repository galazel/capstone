-- Rebyu BKT training view for PostgreSQL.
-- Run this after the main Rebyu assessment tables have been created.
--
-- Column names verified against the live schema on 2026-08-31. The previous
-- version of this file was written against an older data dictionary and
-- referenced two columns that do not exist, so every training run failed with
-- `relation "rebyu_bkt_training_data_v" does not exist` (the view could never
-- be created in the first place):
--
--   led.result  ->  led.is_correct, which is BOOLEAN, not a 0/1 integer
--   et.code     ->  et.exam_type_text
--
-- `is_correct` being boolean also removes the need for the old
-- `WHERE led.result IN (0, 1)` guard: the column is NOT NULL and cannot hold
-- anything else. It is cast to INTEGER here because pyBKT expects 0/1.
--
-- Assumptions still worth checking if this ever breaks again:
--   questions.difficulty_level is EASY / AVERAGE / HARD / DIFFICULT
--   exam_types.exam_type_text holds DIAGNOSTIC, LESSON_QUIZ, MIDDLE_EXAM, ...

CREATE OR REPLACE VIEW rebyu_bkt_training_data_v AS
SELECT
    ROW_NUMBER() OVER (
        ORDER BY
            led.answered_at,
            led.learner_id,
            led.exam_id,
            led.attempt_no,
            led.exam_question_id
    )::BIGINT AS attempt_order,
    led.learner_id::BIGINT AS learner_id,
    COALESCE(led.lesson_id, q.lesson_id)::TEXT AS skill_name,
    eq.question_id::TEXT AS question_id,
    led.is_correct::INTEGER AS is_correct,
    UPPER(q.difficulty_level)::TEXT AS difficulty_level,
    UPPER(et.exam_type_text)::TEXT AS assessment_type,
    led.answered_at,
    e.certification_id::BIGINT AS certification_id,
    COALESCE(led.lesson_id, q.lesson_id)::BIGINT AS lesson_id,
    led.exam_id::BIGINT AS exam_id,
    led.attempt_no::INTEGER AS attempt_no
FROM learner_exam_details led
JOIN exam_questions eq
    ON eq.exam_question_id = led.exam_question_id
JOIN questions q
    ON q.question_id = eq.question_id
JOIN exams e
    ON e.exam_id = led.exam_id
JOIN exam_types et
    ON et.exam_type_id = e.exam_type_id
WHERE COALESCE(led.lesson_id, q.lesson_id) IS NOT NULL
  AND led.answered_at IS NOT NULL;

COMMENT ON VIEW rebyu_bkt_training_data_v IS
'Chronological learner response data consumed by the Rebyu FastAPI BKT service.';
