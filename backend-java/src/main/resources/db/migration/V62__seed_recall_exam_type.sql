-- Recall sessions are learner-generated assessments, but they are still
-- persisted as regular exams and need their own exam type for creation and
-- reporting.
INSERT INTO public.exam_types (exam_type_text)
VALUES ('RECALL')
ON CONFLICT (exam_type_text) DO NOTHING;
