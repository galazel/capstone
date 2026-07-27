package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.learningtools.entity.GeneratedStudyItem;
import com.capstone.rebyu.learningtools.entity.GeneratedStudySet;
import com.capstone.rebyu.learningtools.entity.LearnerPracticeAnswer;
import com.capstone.rebyu.learningtools.entity.LearnerPracticeAttempt;
import com.capstone.rebyu.learningtools.repository.GeneratedStudyItemRepository;
import com.capstone.rebyu.learningtools.repository.GeneratedStudySetRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAnswerRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAttemptRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Owns structured Tutor practice attempts. Correct answers remain server-side. */
@Service
@RequiredArgsConstructor
public class StudyPracticeService {
    private final GeneratedStudySetRepository studySets;
    private final GeneratedStudyItemRepository studyItems;
    private final LearnerPracticeAttemptRepository attempts;
    private final LearnerPracticeAnswerRepository answers;
    private final LessonRepository lessons;
    private final LearnerCertificationRepository enrollments;
    private final ObjectMapper objectMapper;
    private final RewardService rewards;
    private final PracticeMasteryEvidenceService masteryEvidence;

    public record StudyItem(Long id, String type, String questionText, String choicesJson,
                            String explanation, String difficulty, int order) {}
    public record StudySet(Long id, String type, String title, Long certificationId, Long lessonId,
                           List<StudyItem> items) {}
    public record Attempt(Long id, Long studySetId, String status, int totalItems) {}
    public record AnswerResult(Long itemId, boolean correct, String explanation) {}
    public record Completion(Long id, int score, int totalItems, double percentage, int xpEarned, int coinEarned) {}
    public record AttemptHistory(Long id, Long studySetId, String sourceType, String title, String status, int score, int totalItems,
                                 Double percentage, int xpEarned, int coinEarned, OffsetDateTime completedAt) {}
    public record ReviewAnswer(Long itemId, String questionText, String learnerAnswer, boolean correct,
                               String explanation, String flashcardRating, int order) {}
    public record AttemptReview(AttemptHistory attempt, List<ReviewAnswer> answers) {}
    public record GeneratedItem(String type, String questionText, String choicesJson, String correctAnswer,
                                String acceptedAnswersJson, String explanation, String difficulty) {}

    public StudySet studySet(Long learnerId, Long studySetId) {
        GeneratedStudySet set = studySets.findByStudySetIdAndLearnerIdWithItems(studySetId, learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Study set not found"));
        return toStudySet(set);
    }

    public List<AttemptHistory> history(Long learnerId) {
        return attempts.findHistoryWithTitle(learnerId).stream().map(StudyPracticeService::toAttemptHistory).toList();
    }

    public AttemptReview review(Long learnerId, Long attemptId) {
        Object[] row = attempts.findOneWithTitle(learnerId, attemptId)
                .orElseThrow(() -> new EntityNotFoundException("Practice attempt not found"));
        List<ReviewAnswer> reviewAnswers = answers.findByAttemptIdOrderByItemDisplayOrder(attemptId).stream()
                .map(a -> new ReviewAnswer(a.getStudyItem().getStudyItemId(), a.getStudyItem().getQuestionText(),
                        a.getLearnerAnswer(), Boolean.TRUE.equals(a.getIsCorrect()), a.getStudyItem().getExplanation(),
                        a.getFlashcardRating(), a.getStudyItem().getDisplayOrder()))
                .toList();
        return new AttemptReview(toAttemptHistory(row), reviewAnswers);
    }

    /** Persists validated AI output as an answerable study set; never expose answer fields to the client. */
    @Transactional
    public StudySet createGeneratedStudySet(Long learnerId, String studyType, String title, Long lessonId,
                                            List<GeneratedItem> items) {
        if (!List.of("QUIZ", "FLASHCARD").contains(studyType)) throw new IllegalArgumentException("Unsupported study set type");
        if (title == null || title.isBlank()) throw new IllegalArgumentException("Study set title is required");
        if (lessonId == null) throw new IllegalArgumentException("A lesson is required to generate a study set");
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("The generated study set has no items");
        Lesson lesson = lessons.findById(lessonId).orElseThrow(() -> new EntityNotFoundException("Lesson not found"));
        Certification certification = lesson.getMiddleCategory().getMajorCategory().getCertification();

        GeneratedStudySet set = GeneratedStudySet.builder()
                .learner(Learner.builder().learnerId(learnerId).build())
                .certification(certification)
                .lesson(lesson)
                .studyType(studyType)
                .title(title.trim())
                .build();
        int displayOrder = 1;
        for (GeneratedItem item : items) {
            validateGeneratedItem(studyType, item);
            set.getItems().add(GeneratedStudyItem.builder()
                    .studySet(set)
                    .itemType(item.type())
                    .questionText(item.questionText().trim())
                    .choicesJson(item.choicesJson())
                    .correctAnswer(item.correctAnswer())
                    .acceptedAnswersJson(item.acceptedAnswersJson())
                    .explanation(item.explanation())
                    .difficulty(item.difficulty())
                    .displayOrder(displayOrder++)
                    .build());
        }
        return toStudySet(studySets.save(set));
    }

    /** Gives a community learner an independent copy, preserving the author's original study set. */
    @Transactional
    public Attempt startCommunityAttempt(Long learnerId, Long originalStudySetId) {
        String copyKey = "community:" + originalStudySetId;
        var existingCopy = studySets.findFirstByLearner_LearnerIdAndSourceAndGenerationVersion(learnerId, "COMMUNITY", copyKey);
        if (existingCopy.isPresent()) {
            GeneratedStudySet copy = existingCopy.get();
            String sourceType = "QUIZ".equals(copy.getStudyType()) ? "COMMUNITY_QUIZ" : "FLASHCARD_RECALL";
            var active = attempts.findFirstByLearner_LearnerIdAndSourceTypeAndSourceIdAndStatusOrderByStartedAtDesc(
                    learnerId, sourceType, copy.getStudySetId(), "IN_PROGRESS");
            if (active.isPresent()) return toAttempt(active.get());
            return startCommunityCopyAttempt(learnerId, copy.getStudySetId(), "QUIZ".equals(copy.getStudyType()));
        }
        GeneratedStudySet original = studySets.findById(originalStudySetId)
                .orElseThrow(() -> new EntityNotFoundException("Shared study set not found"));
        GeneratedStudySet copy = GeneratedStudySet.builder()
                .learner(Learner.builder().learnerId(learnerId).build())
                .certification(original.getCertification())
                .lesson(original.getLesson())
                .studyType(original.getStudyType())
                .title(original.getTitle())
                .source("COMMUNITY")
                .generationVersion(copyKey)
                .build();
        for (GeneratedStudyItem item : original.getItems()) {
            copy.getItems().add(GeneratedStudyItem.builder()
                    .studySet(copy)
                    .itemType(item.getItemType())
                    .questionText(item.getQuestionText())
                    .choicesJson(item.getChoicesJson())
                    .correctAnswer(item.getCorrectAnswer())
                    .acceptedAnswersJson(item.getAcceptedAnswersJson())
                    .explanation(item.getExplanation())
                    .difficulty(item.getDifficulty())
                    .displayOrder(item.getDisplayOrder())
                    .build());
        }
        GeneratedStudySet savedCopy = studySets.save(copy);
        return startCommunityCopyAttempt(learnerId, savedCopy.getStudySetId(), "QUIZ".equals(original.getStudyType()));
    }

    private Attempt startCommunityCopyAttempt(Long learnerId, Long copyId, boolean quiz) {
        Attempt attempt = startAttempt(learnerId, copyId);
        if (quiz) {
            LearnerPracticeAttempt entity = attempts.findByAttemptIdAndLearner_LearnerId(attempt.id(), learnerId).orElseThrow();
            entity.setSourceType("COMMUNITY_QUIZ");
            attempts.save(entity);
        }
        return attempt;
    }

    @Transactional
    public Attempt startAttempt(Long learnerId, Long studySetId) {
        StudySet set = studySet(learnerId, studySetId);
        boolean enrolled = enrollments.existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                learnerId, set.certificationId(), LearnerCertification.Status.active);
        if (!enrolled) throw new IllegalArgumentException("Active certification enrollment is required");
        String sourceType = "FLASHCARD".equals(set.type()) ? "FLASHCARD_RECALL" : "TUTOR_QUIZ";
        var existing = attempts.findFirstByLearner_LearnerIdAndSourceTypeAndSourceIdAndStatusOrderByStartedAtDesc(
                learnerId, sourceType, studySetId, "IN_PROGRESS");
        if (existing.isPresent()) return toAttempt(existing.get());
        Certification certificationRef = new Certification();
        certificationRef.setCertificationId(set.certificationId());
        Lesson lessonRef = new Lesson();
        lessonRef.setLessonId(set.lessonId());
        LearnerPracticeAttempt entity = LearnerPracticeAttempt.builder()
                .learner(Learner.builder().learnerId(learnerId).build())
                .sourceType(sourceType)
                .sourceId(studySetId)
                .certification(certificationRef)
                .lesson(lessonRef)
                .totalItems(set.items().size())
                .build();
        LearnerPracticeAttempt saved = attempts.save(entity);
        return new Attempt(saved.getAttemptId(), studySetId, "IN_PROGRESS", set.items().size());
    }

    @Transactional
    public AnswerResult submitAnswer(Long learnerId, Long attemptId, Long itemId, String learnerAnswer, String flashcardRating) {
        LearnerPracticeAttempt attempt = attempts.findByAttemptIdAndLearner_LearnerId(attemptId, learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Practice attempt not found"));
        if (!"IN_PROGRESS".equals(attempt.getStatus())) throw new IllegalArgumentException("Practice attempt is no longer active");
        GeneratedStudyItem item = studyItems.findByStudyItemIdAndStudySet_StudySetId(itemId, attempt.getSourceId())
                .orElseThrow(() -> new EntityNotFoundException("Study item not found"));
        validateFlashcardRating(flashcardRating);
        boolean correct = isCorrect(item.getItemType(), item.getChoicesJson(), item.getCorrectAnswer(),
                item.getAcceptedAnswersJson(), learnerAnswer);
        answers.upsertAnswer(attemptId, itemId, learnerAnswer, normalize(learnerAnswer), correct, correct ? 1 : 0, flashcardRating);
        return new AnswerResult(itemId, correct, item.getExplanation());
    }

    @Transactional
    public Completion completeAttempt(Long learnerId, Long attemptId) {
        LearnerPracticeAttempt attempt = attempts.findByAttemptIdAndLearner_LearnerId(attemptId, learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Practice attempt not found"));
        if (!"IN_PROGRESS".equals(attempt.getStatus())) throw new IllegalArgumentException("Practice attempt is no longer active");

        int total = attempt.getTotalItems();
        long answered = answers.countByAttempt_AttemptId(attemptId);
        if (answered < total) throw new IllegalArgumentException("Answer every item before completing this attempt");
        long correct = answers.countByAttempt_AttemptIdAndIsCorrectTrue(attemptId);
        double percentage = total == 0 ? 0 : (correct * 100.0) / total;

        RewardService.PracticeReward reward = rewards.awardCompletedPractice(
                learnerId, attempt.getSourceId(), attempt.getSourceType(), percentage);
        boolean masteryEligible = masteryEvidence.enqueueCompletedAttempt(
                learnerId, attemptId, attempt.getSourceType(), attempt.getSourceId());

        attempt.setStatus("COMPLETED");
        attempt.setScore(BigDecimal.valueOf(correct));
        attempt.setPercentage(BigDecimal.valueOf(percentage));
        attempt.setCompletedAt(OffsetDateTime.now());
        attempt.setXpEarned(reward.xp());
        attempt.setCoinEarned(reward.coins());
        if (masteryEligible) {
            attempt.setMasteryEligible(true);
            attempt.setBktEventId("practice-" + attemptId);
        }
        attempts.save(attempt);

        return new Completion(attemptId, (int) correct, total, percentage, reward.xp(), reward.coins());
    }

    private StudySet toStudySet(GeneratedStudySet set) {
        List<StudyItem> items = set.getItems().stream()
                .map(i -> new StudyItem(i.getStudyItemId(), i.getItemType(), i.getQuestionText(), i.getChoicesJson(),
                        i.getExplanation(), i.getDifficulty(), i.getDisplayOrder()))
                .toList();
        return new StudySet(set.getStudySetId(), set.getStudyType(), set.getTitle(),
                set.getCertification().getCertificationId(), set.getLesson().getLessonId(), items);
    }

    private static Attempt toAttempt(LearnerPracticeAttempt entity) {
        return new Attempt(entity.getAttemptId(), entity.getSourceId(), entity.getStatus(), entity.getTotalItems());
    }

    private static AttemptHistory toAttemptHistory(Object[] row) {
        LearnerPracticeAttempt a = (LearnerPracticeAttempt) row[0];
        String title = (String) row[1];
        Double percentage = a.getPercentage() == null ? null : a.getPercentage().doubleValue();
        return new AttemptHistory(a.getAttemptId(), a.getSourceId(), a.getSourceType(), title, a.getStatus(),
                a.getScore() == null ? 0 : a.getScore().intValue(), a.getTotalItems(), percentage,
                a.getXpEarned(), a.getCoinEarned(), a.getCompletedAt());
    }

    private boolean isCorrect(String type, String choicesJson, String correctAnswer, String acceptedAnswersJson, String answer) {
        String normalized = normalize(answer);
        if (normalized.isEmpty()) return false;
        try {
            if ("MCQ".equals(type) && choicesJson != null) {
                for (JsonNode choice : objectMapper.readTree(choicesJson)) {
                    if (choice.path("isCorrect").asBoolean(false) && normalized.equals(normalize(choice.path("text").asText()))) return true;
                }
            }
            if (normalized.equals(normalize(correctAnswer))) return true;
            if (acceptedAnswersJson != null) {
                for (JsonNode accepted : objectMapper.readTree(acceptedAnswersJson)) if (normalized.equals(normalize(accepted.asText()))) return true;
            }
        } catch (Exception ignored) { return false; }
        return false;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.toLowerCase().replaceAll("[^a-z0-9]+", "").trim();
    }

    private static void validateFlashcardRating(String rating) {
        if (rating == null || rating.isBlank()) return;
        if (!List.of("AGAIN", "HARD", "GOOD", "EASY").contains(rating)) {
            throw new IllegalArgumentException("Flashcard rating must be AGAIN, HARD, GOOD, or EASY");
        }
    }

    private void validateGeneratedItem(String studyType, GeneratedItem item) {
        if (item == null || item.questionText() == null || item.questionText().isBlank()) {
            throw new IllegalArgumentException("Every generated item needs a question");
        }
        if ("QUIZ".equals(studyType) && !"MCQ".equals(item.type())) {
            throw new IllegalArgumentException("Quiz items must be multiple-choice questions");
        }
        if ("FLASHCARD".equals(studyType) && !"FLASHCARD".equals(item.type())) {
            throw new IllegalArgumentException("Flashcard sets must contain flashcards");
        }
        if (item.correctAnswer() == null || item.correctAnswer().isBlank()) {
            throw new IllegalArgumentException("Every generated item needs a correct answer");
        }
        if ("MCQ".equals(item.type())) {
            try {
                JsonNode choices = objectMapper.readTree(item.choicesJson());
                boolean hasCorrectChoice = false;
                if (choices.isArray()) {
                    for (JsonNode choice : choices) {
                        if (choice.path("isCorrect").asBoolean(false)) {
                            hasCorrectChoice = true;
                            break;
                        }
                    }
                }
                if (!choices.isArray() || choices.size() < 2 || !hasCorrectChoice) {
                    throw new IllegalArgumentException("Each multiple-choice item needs choices and one correct answer");
                }
            } catch (Exception ex) {
                if (ex instanceof IllegalArgumentException illegalArgumentException) throw illegalArgumentException;
                throw new IllegalArgumentException("Generated choices are invalid");
            }
        }
    }
}
