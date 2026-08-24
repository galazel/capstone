package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.assessment.entity.Choice;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.entity.TextQuestionConfig;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.assessment.repository.ExamTypeRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Persists the AI tutor's "generate a quiz" / "generate flashcards" output as
 * a real, attemptable exam -- the same {@code exams}/{@code questions}/
 * {@code choices}/{@code text_question_configs} tables a lesson's own quiz
 * lives in, under the {@code GENERATED_QUIZ}/{@code GENERATED_FLASHCARD} exam
 * types (see {@link com.capstone.rebyu.assessment.config.ExamTypeSeeder}).
 *
 * <p>A quiz item becomes an {@code MCQ} question with real {@link Choice}
 * rows; a flashcard becomes a {@code SHORT_ANSWER} question with a
 * {@link TextQuestionConfig} holding the answer -- exactly how every other
 * short-answer question in REBYU is graded, via
 * {@code AssessmentAttemptService#scoreAnswer}.
 *
 * <p>Published immediately rather than left {@code DRAFT}: unlike
 * certification-content generation (which an admin reviews before
 * publishing), there is no review step in the tutor's real-time "make me a
 * quiz" flow -- the learner asked for it and is standing right there.
 */
@Service
@RequiredArgsConstructor
public class GeneratedAssessmentService {

    public static final String QUIZ_EXAM_TYPE = "GENERATED_QUIZ";
    public static final String FLASHCARD_EXAM_TYPE = "GENERATED_FLASHCARD";

    /**
     * The target scope stamped on a practice exam. Named so the readers that
     * need to tell practice from curriculum can key off this constant rather
     * than repeat the literal — see
     * {@code ProgressAnalyticsService#tutorPracticeMarker}.
     */
    public static final String GENERATED_TARGET_SCOPE = "GENERATED";

    /**
     * Longest answer that can fairly be marked by exact string comparison.
     *
     * Mirrors {@code SHORT_ANSWER_MAX_WORDS} in the Python generator's
     * {@code question_schema.py}, which reclassifies any longer short answer
     * as DESCRIPTIVE for exactly this reason: past a handful of words an
     * answer is prose, and prose has many correct spellings and no canonical
     * one. This path never goes through that schema -- flashcards are built
     * here, in Java, straight from the tutor's response -- so the same limit
     * has to be applied here or the rule holds on one generation path and not
     * the other.
     */
    private static final int EXACT_MATCH_MAX_WORDS = 6;

    private final LessonRepository lessons;
    private final ExamTypeRepository examTypes;
    private final ExamRepository exams;
    private final QuestionRepository questions;
    private final ExamQuestionRepository examQuestions;

    /** One generated item, already validated -- a quiz item carries
     * `choices`/`correctAnswer`; a flashcard carries `answer` and leaves
     * those empty. Kept generic so the controller's JSON parsing stays in
     * one place regardless of which shape came back from the AI service. */
    public record GeneratedQuestionItem(
            String questionText,
            List<String> choices,
            String correctAnswer,
            String answer,
            String explanation,
            String difficulty) {}

    public record GeneratedExam(Long examId, String title, Long certificationId, int itemCount) {}

    @Transactional
    public GeneratedExam createGeneratedExam(
            Long learnerId, String type, String title, Long lessonId, List<GeneratedQuestionItem> items) {
        boolean isQuiz = "quiz".equalsIgnoreCase(type);
        if (!isQuiz && !"flashcard".equalsIgnoreCase(type)) {
            throw new IllegalArgumentException("Unsupported study set type");
        }
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("A title is required");
        }
        if (lessonId == null) {
            throw new IllegalArgumentException("A lesson is required to generate an assessment");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("The generated set has no items");
        }

        Lesson lesson = lessons.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("Lesson not found"));
        Certification certification = lesson.getMiddleCategory().getMajorCategory().getCertification();

        String examTypeText = isQuiz ? QUIZ_EXAM_TYPE : FLASHCARD_EXAM_TYPE;
        ExamType examType = examTypes.findByExamTypeText(examTypeText)
                .orElseThrow(() -> new IllegalStateException(
                        "Exam type '" + examTypeText + "' is not seeded -- see ExamTypeSeeder"));

        Learner learner = Learner.builder().learnerId(learnerId).build();

        // `lesson` and `learner` are both set -- this exam belongs to exactly
        // this learner's request against exactly this lesson, and is
        // findable by either. `targetScope("GENERATED")` (a non-empty,
        // non-matching value) is what keeps it out of two places that key off
        // scope rather than lesson_id, despite lesson_id being set:
        //  - ExamService#enforceUniqueness's LESSON-scope uniqueness check
        //    now excludes generated exams explicitly (existsOfficialByLessonId),
        //    but a belt-and-suspenders non-"LESSON" scope keeps this exam out
        //    of any *other* scope-keyed logic that isn't generated-aware yet.
        //  - curriculum-model.js's LESSON_SCOPES groups any exam whose scope
        //    resolves to "LESSON" as *the* lesson's quiz tile; "GENERATED"
        //    doesn't match, so a practice quiz never silently replaces the
        //    official one in the curriculum UI.
        LocalDateTime now = LocalDateTime.now();
        Exam exam = Exam.builder()
                .certification(certification)
                .examType(examType)
                .title(title.trim())
                .isGenerated(true)
                .lesson(lesson)
                .learner(learner)
                .totalQuestions(items.size())
                .passingScore(new BigDecimal("70.00"))
                .status(Exam.Status.PUBLISHED)
                .targetScope(GENERATED_TARGET_SCOPE)
                .publishedAt(now)
                .updatedAt(now)
                .releaseAnswersAfterSubmit(true)
                .build();
        exam = exams.save(exam);

        int displayOrder = 1;
        for (GeneratedQuestionItem item : items) {
            Question question = isQuiz
                    ? buildQuizQuestion(lesson, item)
                    : buildFlashcardQuestion(lesson, item);
            question = questions.save(question);

            examQuestions.save(ExamQuestion.builder()
                    .exam(exam)
                    .question(question)
                    .displayOrder(displayOrder++)
                    .build());
        }

        return new GeneratedExam(exam.getExamId(), exam.getTitle(), certification.getCertificationId(), items.size());
    }

    private Question buildQuizQuestion(Lesson lesson, GeneratedQuestionItem item) {
        validateQuizItem(item);

        Question question = newQuestion(lesson, "MCQ", item);
        // Question.choices has a field initializer (`= new ArrayList<>()`),
        // but Lombok's @Builder ignores field initializers unless the field
        // is marked @Builder.Default -- it isn't here -- so a builder-built
        // Question's `choices` is null, not an empty list. Set a real one
        // before adding to it.
        List<Choice> choices = new ArrayList<>();
        question.setChoices(choices);
        for (String choiceText : item.choices()) {
            choices.add(Choice.builder()
                    .question(question)
                    .choiceText(choiceText)
                    .correct(choiceText.equals(item.correctAnswer()))
                    .build());
        }
        return question;
    }

    private Question buildFlashcardQuestion(Lesson lesson, GeneratedQuestionItem item) {
        if (item.answer() == null || item.answer().isBlank()) {
            throw new IllegalArgumentException("Every flashcard needs an answer");
        }

        /* A flashcard answer is whatever the tutor wrote, and for a "define
         * X" card that is a sentence, not a term. Marked by exact string
         * comparison it is unanswerable -- the learner has to reproduce the
         * model's wording verbatim, punctuation included -- so a long answer
         * is graded on meaning instead. `AssessmentAttemptService#scoreAnswer`
         * already routes SHORT_ANSWER + AI_SEMANTIC through the same grader
         * descriptive answers use; the card stays a card, it just stops being
         * impossible.
         *
         * Short answers keep EXACT_MATCH: "3NF" or "404" should be marked on
         * the string, not sent to a model that might accept a near miss.
         */
        String answer = item.answer().trim();
        boolean exactlyMatchable = answer.split("\\s+").length <= EXACT_MATCH_MAX_WORDS;

        Question question = newQuestion(lesson, "SHORT_ANSWER", item);
        question.setTextQuestionConfig(TextQuestionConfig.builder()
                .question(question)
                .correctAnswer(answer)
                .checkingMethod(exactlyMatchable ? "EXACT_MATCH" : "AI_SEMANTIC")
                .build());
        return question;
    }

    private Question newQuestion(Lesson lesson, String questionType, GeneratedQuestionItem item) {
        if (item.questionText() == null || item.questionText().isBlank()) {
            throw new IllegalArgumentException("Every generated item needs a question");
        }
        String difficulty = normalizeDifficulty(item.difficulty());

        return Question.builder()
                .lesson(lesson)
                .questionType(questionType)
                .difficultyLevel(difficulty)
                .questionText(item.questionText().trim())
                .totalPoints(BigDecimal.ONE)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private void validateQuizItem(GeneratedQuestionItem item) {
        if (item.choices() == null || item.choices().size() < 2) {
            throw new IllegalArgumentException("Each quiz item needs at least two choices");
        }
        if (item.correctAnswer() == null || item.correctAnswer().isBlank()
                || !item.choices().contains(item.correctAnswer())) {
            throw new IllegalArgumentException("Each quiz item needs a correct answer matching one of its choices");
        }
    }

    private static String normalizeDifficulty(String difficulty) {
        String upper = difficulty == null ? "" : difficulty.trim().toUpperCase();
        return List.of("EASY", "AVERAGE", "HARD").contains(upper) ? upper : "AVERAGE";
    }
}
