-- Reference data required by the application after a clean database reset.
-- All inserts are idempotent so the migration is safe to run once per schema.

INSERT INTO public.user_types (user_type_text)
VALUES
    ('ADMIN'),
    ('LEARNER'),
    ('INSTITUTION'),
    ('INSTITUTION_MEMBER')
ON CONFLICT (user_type_text) DO NOTHING;

INSERT INTO public.exam_types (exam_type_text)
VALUES
    ('DIAGNOSTIC'),
    ('QUIZ'),
    ('MODULE_EXAM'),
    ('MOCK_EXAM'),
    ('MAJOR_EXAM'),
    ('MIDDLE_EXAM'),
    ('LESSON_QUIZ'),
    ('GENERATED_QUIZ'),
    ('GENERATED_FLASHCARD')
ON CONFLICT (exam_type_text) DO NOTHING;

INSERT INTO public.achievements (title, description)
VALUES
    ('First Step', 'Complete your first learning activity and take the first step toward your goal.'),
    ('First Quiz', 'Complete your very first quiz and begin your learning journey.'),
    ('First Perfect Score', 'Achieve your first perfect score on a quiz or assessment.'),
    ('Exam Ready', 'Complete your preparation and prove you''re ready to take the exam.'),
    ('Knowledge Seeker', 'Enroll in multiple certifications and expand your knowledge across different fields.'),
    ('Finisher', 'Complete an entire certification review from start to finish.'),
    ('Top Achiever', 'Demonstrate outstanding performance and rank among the top learners.'),
    ('Rebyu Legend', 'Unlock every achievement and become a true Rebyu Legend.')
ON CONFLICT (title) DO NOTHING;

INSERT INTO public.gamification_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
