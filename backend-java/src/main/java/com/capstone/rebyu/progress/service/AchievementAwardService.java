package com.capstone.rebyu.progress.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.gamification.repository.NotificationPreferenceRepository;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.progress.dto.LearnerAchievementViewDto;
import com.capstone.rebyu.progress.entity.Achievement;
import com.capstone.rebyu.progress.entity.LearnerAchievement;
import com.capstone.rebyu.progress.entity.LearnerAchievementId;
import com.capstone.rebyu.progress.repository.AchievementRepository;
import com.capstone.rebyu.progress.repository.LearnerAchievementRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides which achievements a learner has earned, and records them.
 *
 * <p>Server-authoritative, exactly like {@link RewardService}: the browser
 * reports what the learner <em>did</em> (a lesson finished, an attempt
 * submitted) and this service decides what that is worth. The first cut of this
 * feature asked the browser instead -- it checked "is this my first lesson?",
 * then posted `achievementId: 32` -- which let any learner grant themselves any
 * badge with one request, and pinned the award to an id that only exists in one
 * database.
 *
 * <p>Every call re-derives the whole picture from the learner's own data rather
 * than reacting to a single event. That makes it idempotent (an already-earned
 * achievement is skipped, so a retried request awards nothing twice) and
 * self-healing: a learner who met a condition before this feature existed, or
 * during a window where a hook was missing, is awarded on their next completion
 * instead of never.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AchievementAwardService {

    /** "Enroll in multiple certifications" -- two is the smallest number that is "multiple". */
    private static final int KNOWLEDGE_SEEKER_ENROLLMENTS = 2;
    /** Top Achiever needs standing AND substance, so a near-empty leaderboard cannot hand it out. */
    private static final int TOP_ACHIEVER_MAX_RANK = 10;
    private static final long TOP_ACHIEVER_MIN_XP = 1_000L;
    private static final BigDecimal PERFECT_PERCENTAGE = BigDecimal.valueOf(100);
    /** The exam type a learner sits to prove they are ready for the real thing. */
    private static final String MOCK_EXAM_TYPE = "MOCK_EXAM";

    private final AchievementRepository achievementRepository;
    private final LearnerAchievementRepository learnerAchievementRepository;
    private final LearnerCompletedLessonRepository completedLessonRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final LearnerCertificationRepository enrollmentRepository;
    private final LessonRepository lessonRepository;
    private final LearnerRepository learnerRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final NotificationService notificationService;
    private final RewardService rewardService;
    private final EntityManager entityManager;

    /**
     * Re-evaluates every achievement for this learner and records any that are
     * newly earned.
     *
     * <p>Safe to call from any completion flow, as often as that flow runs.
     *
     * @return only what was awarded by <em>this</em> call, which is what the
     *         portal announces to the learner; an empty list means nothing new
     */
    public List<LearnerAchievementViewDto> evaluate(Long learnerId) {
        if (learnerId == null) {
            return List.of();
        }

        Set<AchievementCatalog> earned = earnedCatalogEntries(learnerId);
        Progress progress = collectProgress(learnerId);
        List<LearnerAchievementViewDto> awarded = new ArrayList<>();

        for (AchievementCatalog entry : AchievementCatalog.values()) {
            if (entry == AchievementCatalog.REBYU_LEGEND || earned.contains(entry)) {
                continue;
            }
            if (!isEarned(entry, progress)) {
                continue;
            }
            award(learnerId, entry).ifPresent(view -> {
                earned.add(entry);
                awarded.add(view);
            });
        }

        // Last, and against the set that includes anything just awarded above --
        // otherwise finishing on the seventh badge would leave the Legend
        // hanging until some unrelated completion happened to re-run this.
        boolean allOthers = EnumSet.complementOf(EnumSet.of(AchievementCatalog.REBYU_LEGEND))
                .stream().allMatch(earned::contains);
        if (allOthers && !earned.contains(AchievementCatalog.REBYU_LEGEND)) {
            award(learnerId, AchievementCatalog.REBYU_LEGEND).ifPresent(awarded::add);
        }

        if (!awarded.isEmpty()) {
            log.info("Learner {} earned achievement(s): {}", learnerId,
                    awarded.stream().map(LearnerAchievementViewDto::code).toList());
        }
        return awarded;
    }

    /** The whole catalog for one learner, locked entries included. */
    @Transactional(readOnly = true)
    public List<LearnerAchievementViewDto> catalogFor(Long learnerId) {
        Map<AchievementCatalog, LocalDateTime> earnedAt = new EnumMap<>(AchievementCatalog.class);
        if (learnerId != null) {
            for (LearnerAchievement row : learnerAchievementRepository.findById_LearnerIdOrderByEarnedAtDesc(learnerId)) {
                AchievementCatalog entry = row.getAchievement() == null ? null
                        : AchievementCatalog.byTitle(row.getAchievement().getTitle()).orElse(null);
                if (entry != null) {
                    earnedAt.put(entry, row.getEarnedAt());
                }
            }
        }

        // One read for the whole table rather than a lookup per entry: this runs
        // on every portal load, and the catalog is eight rows.
        Map<String, Long> idsByTitle = achievementRepository.findAll().stream()
                .collect(Collectors.toMap(
                        achievement -> achievement.getTitle().toLowerCase(),
                        Achievement::getAchievementId,
                        (first, second) -> first));

        List<LearnerAchievementViewDto> catalog = new ArrayList<>();
        for (AchievementCatalog entry : AchievementCatalog.values()) {
            catalog.add(new LearnerAchievementViewDto(
                    idsByTitle.get(entry.title().toLowerCase()),
                    entry.name(),
                    entry.slug(),
                    entry.title(),
                    entry.description(),
                    earnedAt.containsKey(entry),
                    earnedAt.get(entry)));
        }
        return catalog;
    }

    // ------------------------------------------------------------------
    // Criteria
    // ------------------------------------------------------------------

    /** Everything the criteria below need, read once per evaluation. */
    private record Progress(
            int completedLessons,
            int activeEnrollments,
            boolean submittedAnyAttempt,
            boolean scoredPerfect,
            boolean passedMockExam,
            boolean finishedACertification,
            boolean rankedAmongTopLearners) {
    }

    private boolean isEarned(AchievementCatalog entry, Progress progress) {
        return switch (entry) {
            case FIRST_STEP -> progress.completedLessons() >= 1;
            case FIRST_QUIZ -> progress.submittedAnyAttempt();
            case FIRST_PERFECT_SCORE -> progress.scoredPerfect();
            case EXAM_READY -> progress.passedMockExam();
            case KNOWLEDGE_SEEKER -> progress.activeEnrollments() >= KNOWLEDGE_SEEKER_ENROLLMENTS;
            case FINISHER -> progress.finishedACertification();
            case TOP_ACHIEVER -> progress.rankedAmongTopLearners();
            // Derived from the other seven in evaluate(), never from progress.
            case REBYU_LEGEND -> false;
        };
    }

    private Progress collectProgress(Long learnerId) {
        Set<Long> completedLessonIds = completedLessonRepository.findByLearner_LearnerId(learnerId).stream()
                .map(completed -> completed.getId() == null ? null : completed.getId().getLessonId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<AssessmentAttempt> submitted = attemptRepository.findByLearnerIdOrderByStartedAtDesc(learnerId).stream()
                .filter(attempt -> attempt.getStatus() == AssessmentAttempt.Status.SUBMITTED)
                .toList();

        boolean scoredPerfect = submitted.stream().anyMatch(attempt ->
                attempt.getPercentage() != null
                        && attempt.getPercentage().compareTo(PERFECT_PERCENTAGE) >= 0);

        boolean passedMockExam = submitted.stream().anyMatch(attempt ->
                Boolean.TRUE.equals(attempt.getPassed()) && isMockExam(attempt));

        List<Long> enrolledCertificationIds = enrollmentRepository.findByLearner_LearnerId(learnerId).stream()
                .filter(enrollment -> enrollment.getStatus() == LearnerCertification.Status.active)
                .map(enrollment -> enrollment.getCertification() == null ? null
                        : enrollment.getCertification().getCertificationId())
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();

        return new Progress(
                completedLessonIds.size(),
                enrolledCertificationIds.size(),
                !submitted.isEmpty(),
                scoredPerfect,
                passedMockExam,
                finishedACertification(enrolledCertificationIds, completedLessonIds),
                rankedAmongTopLearners(learnerId));
    }

    private boolean isMockExam(AssessmentAttempt attempt) {
        return attempt.getExam() != null
                && attempt.getExam().getExamType() != null
                && MOCK_EXAM_TYPE.equalsIgnoreCase(attempt.getExam().getExamType().getExamTypeText());
    }

    /**
     * True once every lesson of any one enrolled certification is complete.
     * Group-authored lessons are excluded: an Institution group's own material is
     * not part of the certification review a learner signed up for, and counting
     * it would make "Finisher" unreachable for that learner alone.
     */
    private boolean finishedACertification(List<Long> certificationIds, Set<Long> completedLessonIds) {
        if (completedLessonIds.isEmpty()) {
            return false;
        }
        for (Long certificationId : certificationIds) {
            List<Lesson> lessons = lessonRepository
                    .findByMiddleCategory_MajorCategory_Certification_CertificationIdAndMiddleCategory_MajorCategory_OwnerGroupIsNull(
                            certificationId);
            if (lessons.isEmpty()) {
                // A certification with no lessons is not "finished" -- it is empty.
                continue;
            }
            boolean all = lessons.stream().allMatch(lesson -> completedLessonIds.contains(lesson.getLessonId()));
            if (all) {
                return true;
            }
        }
        return false;
    }

    /**
     * Standing on the all-time overall leaderboard, floored by an XP minimum.
     * Rank alone would award this to the only learner in a fresh database, which
     * is the opposite of "outstanding performance".
     */
    private boolean rankedAmongTopLearners(Long learnerId) {
        return rewardService.leaderboard(learnerId, "overall", "all").stream()
                .filter(RewardService.LeaderboardEntry::currentLearner)
                .anyMatch(entry -> entry.rank() <= TOP_ACHIEVER_MAX_RANK
                        && entry.xp() >= TOP_ACHIEVER_MIN_XP);
    }

    // ------------------------------------------------------------------
    // Awarding
    // ------------------------------------------------------------------

    private Set<AchievementCatalog> earnedCatalogEntries(Long learnerId) {
        Set<AchievementCatalog> earned = EnumSet.noneOf(AchievementCatalog.class);
        for (LearnerAchievement row : learnerAchievementRepository.findById_LearnerIdOrderByEarnedAtDesc(learnerId)) {
            if (row.getAchievement() != null) {
                AchievementCatalog.byTitle(row.getAchievement().getTitle()).ifPresent(earned::add);
            }
        }
        return earned;
    }

    private Optional<LearnerAchievementViewDto> award(Long learnerId, AchievementCatalog entry) {
        Achievement achievement = achievementRepository.findByTitleIgnoreCase(entry.title()).orElse(null);
        if (achievement == null) {
            // The seeder runs at startup, so this only happens if the row was
            // deleted underneath a running application. Skipping beats failing
            // the lesson completion that triggered the evaluation.
            log.warn("Achievement '{}' is missing from the catalog -- not awarding it", entry.title());
            return Optional.empty();
        }

        LearnerAchievementId id = new LearnerAchievementId();
        id.setLearnerId(learnerId);
        id.setAchievementId(achievement.getAchievementId());
        if (learnerAchievementRepository.existsById(id)) {
            return Optional.empty();
        }

        LocalDateTime earnedAt = LocalDateTime.now();
        LearnerAchievement row = new LearnerAchievement();
        row.setId(id);
        // `@MapsId` fills the embedded id from these associations, and Hibernate
        // NPEs at flush time when they are left null -- the same fix already
        // applied in LearnerCompletedLessonService.
        row.setLearner(entityManager.getReference(Learner.class, learnerId));
        row.setAchievement(achievement);
        row.setEarnedAt(earnedAt);
        learnerAchievementRepository.save(row);

        notifyLearner(learnerId, entry);

        return Optional.of(new LearnerAchievementViewDto(
                achievement.getAchievementId(), entry.name(), entry.slug(),
                entry.title(), entry.description(), true, earnedAt));
    }

    /**
     * Puts the badge in the learner's notification inbox as well as on screen.
     * The in-app celebration only reaches whoever is looking at that tab; an
     * achievement earned by a background flow would otherwise be silent.
     */
    private void notifyLearner(Long learnerId, AchievementCatalog entry) {
        boolean wanted = notificationPreferenceRepository.findByLearner_LearnerId(learnerId)
                .map(preference -> !Boolean.FALSE.equals(preference.getAchievementNotifications()))
                .orElse(true);
        if (!wanted) {
            return;
        }
        learnerRepository.findById(learnerId)
                .map(Learner::getUser)
                .ifPresent(user -> notificationService.notify(
                        user,
                        "Achievement unlocked: " + entry.title(),
                        entry.description(),
                        "/learner/account"));
    }
}
