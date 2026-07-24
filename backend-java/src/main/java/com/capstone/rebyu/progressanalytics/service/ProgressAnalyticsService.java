package com.capstone.rebyu.progressanalytics.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptAnswer;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptQuestion;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptAnswerRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptQuestionRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.dto.MasteryHistoryView;
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.capstone.rebyu.bkt.service.LearnerMasteryService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.challenge.entity.ChallengeSession;
import com.capstone.rebyu.challenge.repository.ChallengeSessionRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.CategoryMasteryRow;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.MasteryTrendPoint;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.PerformanceBucket;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.ProgressAnalyticsResponse;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.RecentActivityItem;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.RecommendationRow;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.ScoreTrendPoint;
import com.capstone.rebyu.progressanalytics.dto.ProgressAnalyticsDtos.TopicRow;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Aggregates real learner data (assessment attempts, BKT mastery/priority via
 * FastAPI, completed lessons, challenge sessions) into one certification-scoped
 * analytics view. No field is ever fabricated: absent data comes back as null,
 * zero, or an empty list rather than a placeholder value.
 */
@Service
@RequiredArgsConstructor
public class ProgressAnalyticsService {

    private static final double MASTERED_THRESHOLD = 0.85;
    private static final double WEAK_THRESHOLD = 0.70;
    private static final double HIGHEST_PRIORITY_THRESHOLD = 0.40;
    private static final int RECENT_ACTIVITY_LIMIT = 10;
    private static final int TOPIC_LIST_LIMIT = 6;
    private static final int RECOMMENDATION_LIMIT = 8;

    private final CertificationRepository certificationRepository;
    private final LearnerCertificationRepository learnerCertificationRepository;
    private final AssessmentAttemptRepository assessmentAttemptRepository;
    private final AssessmentAttemptQuestionRepository attemptQuestionRepository;
    private final AssessmentAttemptAnswerRepository attemptAnswerRepository;
    private final QuestionRepository questionRepository;
    private final ChallengeSessionRepository challengeSessionRepository;
    private final LessonRepository lessonRepository;
    private final OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;
    private final LearnerCompletedLessonRepository learnerCompletedLessonRepository;
    private final LearnerMasteryService learnerMasteryService;
    private final BktEventFactory bktEventFactory;

    @Transactional(readOnly = true)
    public ProgressAnalyticsResponse getProgressAnalytics(Long learnerId, Long certificationId) {
        Certification certification = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));

        // Two ways to be enrolled, and both must count here. A learner who bought
        // the certification themselves gets a learner_certifications row; one an
        // organization sponsors gets only an organization_certification_learners
        // row (see LearnerService.acceptInvitation, which never writes the
        // former). Checking just the first made every enterprise learner look
        // unenrolled -- including on their own analytics page.
        boolean selfEnrolled = learnerCertificationRepository
                .existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        learnerId, certificationId, LearnerCertification.Status.active);
        boolean organizationSponsored = organizationCertificationLearnerRepository
                .existsByLearner_LearnerIdAndOrgCert_Certification_CertificationIdAndStatus(
                        learnerId, certificationId, OrganizationCertificationLearner.Status.active);
        if (!selfEnrolled && !organizationSponsored) {
            throw new EntityNotFoundException("No active enrollment in this certification");
        }

        List<AssessmentAttempt> attempts = assessmentAttemptRepository
                .findByLearnerIdAndExam_Certification_CertificationIdAndStatus(
                        learnerId, certificationId, AssessmentAttempt.Status.SUBMITTED);
        Map<Long, AssessmentAttempt> attemptById = attempts.stream()
                .collect(Collectors.toMap(AssessmentAttempt::getAssessmentAttemptId, a -> a));
        List<Long> attemptIds = new ArrayList<>(attemptById.keySet());

        List<AssessmentAttemptQuestion> questions = attemptIds.isEmpty()
                ? List.of() : attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(attemptIds);
        List<AssessmentAttemptAnswer> answers = attemptIds.isEmpty()
                ? List.of() : attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(attemptIds);
        Map<Long, AssessmentAttemptAnswer> answerByQuestionId = answers.stream()
                .collect(Collectors.toMap(a -> a.getAttemptQuestion().getAttemptQuestionId(), a -> a));

        Set<Long> sourceQuestionIds = questions.stream()
                .map(AssessmentAttemptQuestion::getSourceQuestionId)
                .collect(Collectors.toSet());
        Map<Long, Question> questionById = sourceQuestionIds.isEmpty()
                ? Map.of()
                : questionRepository.findAllById(sourceQuestionIds).stream()
                        .collect(Collectors.toMap(Question::getQuestionId, q -> q));

        Map<String, int[]> byDifficulty = new LinkedHashMap<>();
        Map<String, int[]> byQuestionType = new LinkedHashMap<>();
        Map<String, int[]> byAssessmentType = new LinkedHashMap<>();
        int totalCorrect = 0;
        int totalIncorrect = 0;

        for (AssessmentAttemptQuestion question : questions) {
            AssessmentAttemptAnswer answer = answerByQuestionId.get(question.getAttemptQuestionId());
            if (answer == null || answer.isPendingManualEvaluation() || answer.getIsCorrect() == null) {
                continue; // unanswered / pending manual grading -- excluded from final graded counts
            }
            boolean correct = Boolean.TRUE.equals(answer.getIsCorrect());
            if (correct) {
                totalCorrect++;
            } else {
                totalIncorrect++;
            }

            Question sourceQuestion = questionById.get(question.getSourceQuestionId());
            String difficulty = bktEventFactory.normalizeDifficulty(
                    sourceQuestion == null ? null : sourceQuestion.getDifficultyLevel());
            String questionType = question.getQuestionType();
            AssessmentAttempt attempt = attemptById.get(question.getAttempt().getAssessmentAttemptId());
            String assessmentType = (attempt != null && attempt.getExam() != null && attempt.getExam().getExamType() != null)
                    ? attempt.getExam().getExamType().getExamTypeText() : "UNKNOWN";

            bump(byDifficulty, difficulty, correct);
            bump(byQuestionType, questionType, correct);
            bump(byAssessmentType, assessmentType, correct);
        }

        int totalAssessmentAttempts = attempts.size();
        Double averageAssessmentScore = average(attempts.stream()
                .map(AssessmentAttempt::getPercentage)
                .filter(Objects::nonNull)
                .map(BigDecimal::doubleValue)
                .toList());

        List<ScoreTrendPoint> scoreTrend = attempts.stream()
                .filter(a -> a.getSubmittedAt() != null)
                .sorted(Comparator.comparing(AssessmentAttempt::getSubmittedAt))
                .map(a -> new ScoreTrendPoint(
                        a.getAssessmentAttemptId(),
                        a.getSubmittedAt(),
                        a.getExam() != null ? a.getExam().getTitle() : null,
                        (a.getExam() != null && a.getExam().getExamType() != null)
                                ? a.getExam().getExamType().getExamTypeText() : null,
                        a.getPercentage(),
                        a.getPassed()))
                .toList();

        Set<LocalDate> activeDays = attempts.stream()
                .map(AssessmentAttempt::getSubmittedAt)
                .filter(Objects::nonNull)
                .map(LocalDateTime::toLocalDate)
                .collect(Collectors.toSet());
        int studyStreakDays = 0;
        LocalDate cursor = LocalDate.now();
        while (activeDays.contains(cursor)) {
            studyStreakDays++;
            cursor = cursor.minusDays(1);
        }

        List<ChallengeSession> sessions = challengeSessionRepository.findByLearner_LearnerId(learnerId);
        List<ChallengeSession> finishedChallenges = sessions.stream()
                .filter(s -> s.getStatus() == ChallengeSession.Status.passed
                        || s.getStatus() == ChallengeSession.Status.failed)
                .toList();
        int totalChallengeAttempts = finishedChallenges.size();
        Double averageChallengeScore = average(finishedChallenges.stream()
                .map(ChallengeSession::getScore)
                .filter(Objects::nonNull)
                .map(BigDecimal::doubleValue)
                .toList());
        boolean hasChallengeActivity = !sessions.isEmpty();

        // Official lessons only. The unfiltered query counts every lesson on the
        // certification including ones private to an Enterprise group, so a
        // learner's total -- and therefore their completion percentage -- used to
        // move whenever an unrelated group authored content the learner cannot
        // see, let alone complete.
        List<Lesson> certLessons = lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationIdAndMiddleCategory_MajorCategory_OwnerGroupIsNull(
                        certificationId);
        int totalLessonCount = certLessons.size();
        Map<Long, Lesson> lessonById = certLessons.stream()
                .collect(Collectors.toMap(Lesson::getLessonId, l -> l));

        List<LearnerCompletedLesson> completedLessons = learnerCompletedLessonRepository
                .findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
                        learnerId, certificationId);
        int completedLessonCount = completedLessons.size();
        Double completionPercentage = totalLessonCount == 0 ? null
                : (completedLessonCount * 100.0 / totalLessonCount);

        LearnerMasteryService.LessonPrioritiesResult bktResult =
                learnerMasteryService.getLessonPrioritiesForAnalytics(learnerId, certificationId);
        boolean bktAvailable = bktResult.available();
        List<LessonPriorityView> lessonPriorities = bktResult.lessons();
        Map<Long, LessonPriorityView> priorityByLessonId = lessonPriorities.stream()
                .filter(l -> l.lessonId() != null)
                .collect(Collectors.toMap(LessonPriorityView::lessonId, l -> l, (a, b) -> a));

        Set<Long> assessedLessonIds = priorityByLessonId.keySet();
        int unassessedTopicCount = (int) certLessons.stream()
                .map(Lesson::getLessonId)
                .filter(id -> !assessedLessonIds.contains(id))
                .count();

        List<Double> assessedMasteries = lessonPriorities.stream()
                .map(LessonPriorityView::masteryProbability)
                .filter(Objects::nonNull)
                .toList();
        Double averageMastery = average(assessedMasteries);
        Double overallMasteryPercentage = averageMastery == null ? null : averageMastery * 100.0;
        int masteredTopicCount = (int) assessedMasteries.stream().filter(m -> m >= MASTERED_THRESHOLD).count();
        int weakTopicCount = (int) assessedMasteries.stream().filter(m -> m < WEAK_THRESHOLD).count();
        int highestPriorityTopicCount = (int) assessedMasteries.stream().filter(m -> m < HIGHEST_PRIORITY_THRESHOLD).count();

        LearnerMasteryService.ConfidenceResult confidenceResult =
                learnerMasteryService.getConfidenceForAnalytics(learnerId, certificationId);
        Double confidencePercentage = (confidenceResult.available() && confidenceResult.confidence() != null)
                ? confidenceResult.confidence().confidenceScore() : null;

        Double readinessPercentage = computeReadiness(learnerId, certLessons, attempts);

        List<CategoryMasteryRow> categoryMastery = buildCategoryMastery(certLessons, priorityByLessonId, completedLessons);

        List<TopicRow> weakestTopics = lessonPriorities.stream()
                .filter(l -> l.masteryProbability() != null)
                .sorted(Comparator
                        .<LessonPriorityView>comparingInt(l -> "HIGHEST_PRIORITY".equals(l.priorityTag()) ? 0 : 1)
                        .thenComparing(LessonPriorityView::masteryProbability))
                .limit(TOPIC_LIST_LIMIT)
                .map(l -> toTopicRow(l, lessonById))
                .toList();

        List<TopicRow> strongestTopics = lessonPriorities.stream()
                .filter(l -> l.masteryProbability() != null && l.evidenceCount() != null && l.evidenceCount() > 0)
                .sorted(Comparator.comparing(LessonPriorityView::masteryProbability).reversed())
                .limit(TOPIC_LIST_LIMIT)
                .map(l -> toTopicRow(l, lessonById))
                .toList();

        LearnerMasteryService.MasteryHistoryResult historyResult =
                learnerMasteryService.getMasteryHistoryForAnalytics(learnerId, certificationId);
        List<MasteryTrendPoint> masteryTrend = historyResult.history().stream()
                .map(h -> new MasteryTrendPoint(
                        parseDateTime(h.createdAt()),
                        h.lessonId(),
                        lessonById.containsKey(h.lessonId()) ? lessonById.get(h.lessonId()).getName() : null,
                        h.previousMastery(),
                        h.finalMastery(),
                        h.newMasteryLevel(),
                        h.assessmentType()))
                .toList();

        List<RecentActivityItem> recentActivity = buildRecentActivity(attempts, finishedChallenges);

        List<RecommendationRow> recommendations = buildRecommendations(
                lessonPriorities, historyResult.history(), certLessons, lessonById);

        return new ProgressAnalyticsResponse(
                learnerId,
                certificationId,
                certification.getTitle(),
                LocalDateTime.now(),
                bktAvailable,
                !attempts.isEmpty(),
                hasChallengeActivity,
                overallMasteryPercentage,
                confidencePercentage,
                readinessPercentage,
                masteredTopicCount,
                weakTopicCount,
                unassessedTopicCount,
                highestPriorityTopicCount,
                totalLessonCount,
                completedLessonCount,
                completionPercentage,
                totalAssessmentAttempts,
                totalChallengeAttempts,
                false,
                averageAssessmentScore,
                averageChallengeScore,
                totalCorrect,
                totalIncorrect,
                false,
                studyStreakDays,
                recentActivity,
                masteryTrend,
                scoreTrend,
                toBuckets(byDifficulty),
                toBuckets(byQuestionType),
                toBuckets(byAssessmentType),
                categoryMastery,
                weakestTopics,
                strongestTopics,
                recommendations
        );
    }

    private void bump(Map<String, int[]> map, String key, boolean correct) {
        String bucketKey = key == null ? "UNKNOWN" : key;
        int[] counts = map.computeIfAbsent(bucketKey, k -> new int[2]);
        if (correct) {
            counts[0]++;
        } else {
            counts[1]++;
        }
    }

    private List<PerformanceBucket> toBuckets(Map<String, int[]> map) {
        List<PerformanceBucket> buckets = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : map.entrySet()) {
            int correct = entry.getValue()[0];
            int incorrect = entry.getValue()[1];
            int total = correct + incorrect;
            Double accuracy = total == 0 ? null : (correct * 100.0 / total);
            buckets.add(new PerformanceBucket(entry.getKey(), total, correct, incorrect, accuracy));
        }
        return buckets;
    }

    private Double average(List<Double> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.size();
    }

    private Double computeReadiness(Long learnerId, List<Lesson> certLessons, List<AssessmentAttempt> attempts) {
        if (certLessons.isEmpty()) {
            return null;
        }
        Map<String, List<Double>> scoresByNormalizedType = new HashMap<>();
        for (AssessmentAttempt attempt : attempts) {
            if (attempt.getPercentage() == null || attempt.getExam() == null || attempt.getExam().getExamType() == null) {
                continue;
            }
            String normalized = bktEventFactory.normalizeAssessmentType(attempt.getExam().getExamType().getExamTypeText());
            scoresByNormalizedType.computeIfAbsent(normalized, k -> new ArrayList<>())
                    .add(attempt.getPercentage().doubleValue());
        }

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("learner_id", learnerId);
        request.put("lesson_ids", certLessons.stream().map(Lesson::getLessonId).toList());
        putIfPresent(request, "diagnostic_score", average(scoresByNormalizedType.get("DIAGNOSTIC")));
        putIfPresent(request, "lesson_quiz_score", average(scoresByNormalizedType.get("LESSON_QUIZ")));
        putIfPresent(request, "middle_exam_score", average(scoresByNormalizedType.get("MIDDLE_EXAM")));
        putIfPresent(request, "mock_exam_score", average(scoresByNormalizedType.get("MOCK_EXAM")));

        Map<String, Object> response = learnerMasteryService.getReadiness(request);
        if (response == null || "TEMPORARILY_UNAVAILABLE".equals(response.get("status"))) {
            return null;
        }
        Object score = response.get("readiness_score");
        return score instanceof Number number ? number.doubleValue() : null;
    }

    private void putIfPresent(Map<String, Object> request, String key, Double value) {
        if (value != null) {
            request.put(key, value);
        }
    }

    private List<CategoryMasteryRow> buildCategoryMastery(
            List<Lesson> certLessons,
            Map<Long, LessonPriorityView> priorityByLessonId,
            List<LearnerCompletedLesson> completedLessons) {

        Set<Long> completedLessonIds = completedLessons.stream()
                .map(c -> c.getLesson().getLessonId())
                .collect(Collectors.toSet());

        Map<Long, MiddleCategory> middleCategoryById = new LinkedHashMap<>();
        Map<Long, List<Lesson>> lessonsByMiddleCategory = new LinkedHashMap<>();
        for (Lesson lesson : certLessons) {
            MiddleCategory middleCategory = lesson.getMiddleCategory();
            if (middleCategory == null) {
                continue;
            }
            middleCategoryById.putIfAbsent(middleCategory.getMiddleCategoryId(), middleCategory);
            lessonsByMiddleCategory.computeIfAbsent(middleCategory.getMiddleCategoryId(), k -> new ArrayList<>()).add(lesson);
        }

        Map<Long, MajorCategory> majorCategoryById = new LinkedHashMap<>();
        Map<Long, List<Long>> middleIdsByMajor = new LinkedHashMap<>();
        for (MiddleCategory middleCategory : middleCategoryById.values()) {
            MajorCategory major = middleCategory.getMajorCategory();
            if (major == null) {
                continue;
            }
            majorCategoryById.putIfAbsent(major.getMajorCategoryId(), major);
            middleIdsByMajor.computeIfAbsent(major.getMajorCategoryId(), k -> new ArrayList<>())
                    .add(middleCategory.getMiddleCategoryId());
        }

        Map<Long, CategoryMasteryRow> middleRows = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Lesson>> entry : lessonsByMiddleCategory.entrySet()) {
            MiddleCategory middleCategory = middleCategoryById.get(entry.getKey());
            middleRows.put(entry.getKey(), buildCategoryRow(
                    middleCategory.getMiddleCategoryId(), middleCategory.getTitle(), "MIDDLE",
                    entry.getValue(), priorityByLessonId, completedLessonIds, List.of()));
        }

        List<CategoryMasteryRow> majorRows = new ArrayList<>();
        for (Map.Entry<Long, List<Long>> entry : middleIdsByMajor.entrySet()) {
            MajorCategory major = majorCategoryById.get(entry.getKey());
            List<CategoryMasteryRow> children = entry.getValue().stream()
                    .map(middleRows::get)
                    .filter(Objects::nonNull)
                    .toList();
            List<Lesson> allLessonsUnderMajor = entry.getValue().stream()
                    .flatMap(middleId -> lessonsByMiddleCategory.getOrDefault(middleId, List.of()).stream())
                    .toList();
            majorRows.add(buildCategoryRow(
                    major.getMajorCategoryId(), major.getTitle(), "MAJOR",
                    allLessonsUnderMajor, priorityByLessonId, completedLessonIds, children));
        }
        return majorRows;
    }

    private CategoryMasteryRow buildCategoryRow(
            Long categoryId, String title, String level,
            List<Lesson> lessons,
            Map<Long, LessonPriorityView> priorityByLessonId,
            Set<Long> completedLessonIds,
            List<CategoryMasteryRow> children) {

        int total = lessons.size();
        int completed = 0;
        int assessed = 0;
        int weak = 0;
        int highestPriority = 0;
        List<Double> masteries = new ArrayList<>();
        for (Lesson lesson : lessons) {
            if (completedLessonIds.contains(lesson.getLessonId())) {
                completed++;
            }
            LessonPriorityView priority = priorityByLessonId.get(lesson.getLessonId());
            if (priority != null && priority.masteryProbability() != null) {
                assessed++;
                double mastery = priority.masteryProbability();
                masteries.add(mastery);
                if (mastery < WEAK_THRESHOLD) {
                    weak++;
                }
                if (mastery < HIGHEST_PRIORITY_THRESHOLD) {
                    highestPriority++;
                }
            }
        }
        Double avgMastery = average(masteries);
        Double masteryPercentage = avgMastery == null ? null : avgMastery * 100.0;
        String masteryLevel = classifyMasteryLevel(avgMastery);
        String priorityCode = highestPriority > 0 ? "HIGHEST_PRIORITY"
                : weak > 0 ? "WEAK" : assessed > 0 ? "ON_TRACK" : "UNASSESSED";

        return new CategoryMasteryRow(categoryId, title, level, masteryPercentage, masteryLevel, priorityCode,
                assessed, total, completed, weak, highestPriority, children);
    }

    private String classifyMasteryLevel(Double avgMastery) {
        if (avgMastery == null) {
            return "UNASSESSED";
        }
        if (avgMastery >= MASTERED_THRESHOLD) {
            return "MASTERED";
        }
        if (avgMastery >= WEAK_THRESHOLD) {
            return "GOOD";
        }
        if (avgMastery >= HIGHEST_PRIORITY_THRESHOLD) {
            return "DEVELOPING";
        }
        return "WEAK";
    }

    private TopicRow toTopicRow(LessonPriorityView priority, Map<Long, Lesson> lessonById) {
        Lesson lesson = lessonById.get(priority.lessonId());
        Long categoryId = (lesson != null && lesson.getMiddleCategory() != null)
                ? lesson.getMiddleCategory().getMiddleCategoryId() : null;
        String categoryTitle = (lesson != null && lesson.getMiddleCategory() != null)
                ? lesson.getMiddleCategory().getTitle() : null;
        String title = priority.lessonTitle() != null ? priority.lessonTitle() : (lesson != null ? lesson.getName() : null);
        Double masteryPercentage = priority.masteryProbability() == null ? null : priority.masteryProbability() * 100.0;
        return new TopicRow(priority.lessonId(), title, categoryId, categoryTitle, masteryPercentage,
                priority.priorityTag(), priority.evidenceCount(), priority.lastAssessedAt());
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(value).toLocalDateTime();
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    private List<RecentActivityItem> buildRecentActivity(
            List<AssessmentAttempt> attempts, List<ChallengeSession> finishedChallenges) {
        List<RecentActivityItem> items = new ArrayList<>();
        for (AssessmentAttempt attempt : attempts) {
            if (attempt.getSubmittedAt() == null) {
                continue;
            }
            String title = attempt.getExam() != null ? attempt.getExam().getTitle() : "Assessment";
            items.add(new RecentActivityItem("ASSESSMENT", title, attempt.getSubmittedAt(),
                    attempt.getPercentage() == null ? null : attempt.getPercentage().doubleValue(),
                    attempt.getPassed()));
        }
        for (ChallengeSession session : finishedChallenges) {
            if (session.getEndedAt() == null) {
                continue;
            }
            String title = session.getChallengeMode() != null ? session.getChallengeMode().getName() : "Challenge";
            items.add(new RecentActivityItem("CHALLENGE", title, session.getEndedAt(),
                    session.getScore() == null ? null : session.getScore().doubleValue(),
                    session.getStatus() == ChallengeSession.Status.passed));
        }
        return items.stream()
                .sorted(Comparator.comparing(RecentActivityItem::occurredAt).reversed())
                .limit(RECENT_ACTIVITY_LIMIT)
                .toList();
    }

    private List<RecommendationRow> buildRecommendations(
            List<LessonPriorityView> lessonPriorities,
            List<MasteryHistoryView> history,
            List<Lesson> certLessons,
            Map<Long, Lesson> lessonById) {

        List<RecommendationRow> recommendations = new ArrayList<>();
        Set<Long> added = new HashSet<>();

        lessonPriorities.stream()
                .filter(l -> l.masteryProbability() != null && l.masteryProbability() < HIGHEST_PRIORITY_THRESHOLD)
                .sorted(Comparator.comparing(LessonPriorityView::masteryProbability))
                .forEach(l -> {
                    if (recommendations.size() >= RECOMMENDATION_LIMIT || !added.add(l.lessonId())) {
                        return;
                    }
                    recommendations.add(new RecommendationRow(l.lessonId(), resolveTitle(l, lessonById),
                            String.format("Mastery is at %.0f%% -- this is one of your most urgent topics.",
                                    l.masteryProbability() * 100.0),
                            l.recommendedAction(), "HIGHEST_PRIORITY"));
                });

        addByTag(recommendations, added, lessonPriorities, lessonById, "HIGH_PRIORITY");
        addByTag(recommendations, added, lessonPriorities, lessonById, "MEDIUM_PRIORITY");

        Map<Long, Long> recentMissCounts = history.stream()
                .filter(h -> !h.observedCorrect())
                .collect(Collectors.groupingBy(MasteryHistoryView::lessonId, Collectors.counting()));
        recentMissCounts.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .forEach(e -> {
                    if (recommendations.size() >= RECOMMENDATION_LIMIT || !added.add(e.getKey())) {
                        return;
                    }
                    Lesson lesson = lessonById.get(e.getKey());
                    String title = lesson != null ? lesson.getName() : ("Lesson " + e.getKey());
                    recommendations.add(new RecommendationRow(e.getKey(), title,
                            "Missed " + e.getValue() + " of the recent questions on this topic.",
                            "Review recent mistakes", "REPEATED_MISTAKE"));
                });

        Map<Long, LessonPriorityView> priorityByLessonId = lessonPriorities.stream()
                .collect(Collectors.toMap(LessonPriorityView::lessonId, l -> l, (a, b) -> a));
        List<RecommendationRow> currentSnapshot = new ArrayList<>(recommendations);
        for (RecommendationRow rec : currentSnapshot) {
            if (recommendations.size() >= RECOMMENDATION_LIMIT) {
                break;
            }
            Lesson strugglingLesson = lessonById.get(rec.lessonId());
            if (strugglingLesson == null || strugglingLesson.getMiddleCategory() == null) {
                continue;
            }
            List<Lesson> siblings = certLessons.stream()
                    .filter(l -> l.getMiddleCategory() != null
                            && l.getMiddleCategory().getMiddleCategoryId()
                                    .equals(strugglingLesson.getMiddleCategory().getMiddleCategoryId())
                            && l.getLessonId() < strugglingLesson.getLessonId())
                    .sorted(Comparator.comparing(Lesson::getLessonId))
                    .toList();
            for (Lesson sibling : siblings) {
                if (recommendations.size() >= RECOMMENDATION_LIMIT) {
                    break;
                }
                if (added.contains(sibling.getLessonId())) {
                    continue;
                }
                LessonPriorityView siblingPriority = priorityByLessonId.get(sibling.getLessonId());
                boolean weakOrUnassessed = siblingPriority == null
                        || siblingPriority.masteryProbability() == null
                        || siblingPriority.masteryProbability() < WEAK_THRESHOLD;
                if (weakOrUnassessed) {
                    added.add(sibling.getLessonId());
                    recommendations.add(new RecommendationRow(sibling.getLessonId(), sibling.getName(),
                            "Comes before '" + strugglingLesson.getName()
                                    + "' in this module -- reviewing it first may help close the gap.",
                            "Review prerequisite lesson",
                            siblingPriority != null ? siblingPriority.priorityTag() : "UNASSESSED"));
                }
            }
        }

        return recommendations;
    }

    private void addByTag(
            List<RecommendationRow> recommendations, Set<Long> added,
            List<LessonPriorityView> lessonPriorities, Map<Long, Lesson> lessonById, String tag) {
        lessonPriorities.stream()
                .filter(l -> tag.equals(l.priorityTag()))
                .forEach(l -> {
                    if (recommendations.size() >= RECOMMENDATION_LIMIT || !added.add(l.lessonId())) {
                        return;
                    }
                    String reason = l.primaryReason() != null ? l.primaryReason() : ("Flagged as " + l.priorityLabel());
                    recommendations.add(new RecommendationRow(l.lessonId(), resolveTitle(l, lessonById),
                            reason, l.recommendedAction(), tag));
                });
    }

    private String resolveTitle(LessonPriorityView priority, Map<Long, Lesson> lessonById) {
        if (priority.lessonTitle() != null) {
            return priority.lessonTitle();
        }
        Lesson lesson = lessonById.get(priority.lessonId());
        return lesson != null ? lesson.getName() : ("Lesson " + priority.lessonId());
    }
}
