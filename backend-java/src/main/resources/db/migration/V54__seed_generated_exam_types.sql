-- Exam types for AI-tutor-generated content. LearnerToolsController#generate
-- now writes real exams/questions under these types instead of the bespoke
-- generated_study_sets/generated_study_items tables, so a learner attempts a
-- generated quiz or flashcard set through the same assessment-attempt flow
-- as a lesson quiz.
INSERT INTO public.exam_types (exam_type_text)
VALUES
    ('GENERATED_QUIZ'),
    ('GENERATED_FLASHCARD')
ON CONFLICT (exam_type_text) DO NOTHING;
