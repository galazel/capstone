package com.capstone.rebyu.user.service;

import com.capstone.rebyu.assessment.mapper.ExamResultMapper;
import com.capstone.rebyu.assessment.repository.ExamResultRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.LearnerCertificationMapper;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.progress.analytics.dto.CertificationProgressDto;
import com.capstone.rebyu.progress.analytics.service.ProgressAnalyticsService;
import com.capstone.rebyu.progress.mapper.ActivityLogMapper;
import com.capstone.rebyu.progress.mapper.LearnerCompletedLessonMapper;
import com.capstone.rebyu.progress.repository.ActivityLogRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.user.dto.LearnerDto;
import com.capstone.rebyu.user.dto.LearnerPortalDto;
import com.capstone.rebyu.user.mapper.LearnerMapper;
import com.capstone.rebyu.user.mapper.UserMapper;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Learner-scoped read model for the learner portal. Every list is filtered to the
 * authenticated learner/user server-side, closing the leak where the portal fetched
 * flat global lists (all learners, users, completed lessons, exam results, org
 * allocations) and filtered them in the browser.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LearnerPortalService {

    private final LearnerRepository learnerRepository;
    private final LearnerMapper learnerMapper;
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final LearnerCertificationRepository learnerCertificationRepository;
    private final LearnerCertificationMapper learnerCertificationMapper;
    private final LearnerCompletedLessonRepository completedLessonRepository;
    private final LearnerCompletedLessonMapper completedLessonMapper;
    private final ActivityLogRepository activityLogRepository;
    private final ActivityLogMapper activityLogMapper;
    private final ExamResultRepository examResultRepository;
    private final ExamResultMapper examResultMapper;
    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final OrganizationCertificationLearnerMapper orgCertLearnerMapper;
    private final OrganizationCertificateMapper orgCertMapper;
    private final RewardService rewardService;
    private final AchievementAwardService achievementAwardService;
    private final ProgressAnalyticsService progressAnalyticsService;

    public LearnerDto currentLearner(Long learnerId) {
        return learnerRepository.findById(learnerId).map(learnerMapper::toDto).orElse(null);
    }

    // Overrides the class-level readOnly=true: RewardService.balance() below
    // calls ensureBalance(), a native upsert (@Modifying INSERT ... ON
    // CONFLICT) that joins this method's transaction rather than starting its
    // own. Under a read-only transaction that INSERT is rejected by the
    // database, which is what turned this endpoint into a 500 the moment the
    // XP balance lookup was added.
    @Transactional
    public LearnerPortalDto portal(Long learnerId, Long userId) {
        List<OrganizationCertificationLearner> orgCertLearnerEntities =
                orgCertLearnerRepository.findByLearner_LearnerId(learnerId);

        // The learner's own certification allocations, deduped -- these are the only
        // org certificates the portal needs (to map orgCertId -> certificationId).
        Map<Long, OrganizationCertificate> orgCertsById = new LinkedHashMap<>();
        for (OrganizationCertificationLearner row : orgCertLearnerEntities) {
            OrganizationCertificate orgCert = row.getOrgCert();
            if (orgCert != null) {
                orgCertsById.putIfAbsent(orgCert.getOrgCertId(), orgCert);
            }
        }
        List<OrganizationCertificateDto> orgCertificates = orgCertsById.values().stream()
                .map(orgCertMapper::toDto).toList();

        RewardService.Balance rewardBalance = rewardService.balance(learnerId);
        Long totalXp = rewardBalance.xp();
        java.math.BigDecimal coinBalance = java.math.BigDecimal.valueOf(rewardBalance.coins());
        Long aiCreditsRemaining = (long) rewardBalance.aiCredits();

        // Reuse these learner-scoped reads throughout the portal response.
        // The portal is a cold-load endpoint, so repeating the same queries
        // after calculating progress adds latency without changing the result.
        List<LearnerCertification> learnerCertifications =
                learnerCertificationRepository.findByLearner_LearnerId(learnerId);
        List<com.capstone.rebyu.progress.entity.LearnerCompletedLesson> completedLessons =
                completedLessonRepository.findByLearner_LearnerId(learnerId);

        // Fetch BKT mastery state per certification (stubbed for now)
        Map<Long, Integer> masteryByCertification = new java.util.HashMap<>();

        /* Progress per enrolled certification, counted once, server-side.
         *
         * Both routes into a certification count: a self-purchased enrollment
         * writes learner_certifications, an organization-sponsored one writes
         * only organization_certification_learners, and a learner can hold
         * both. Deduped, or a certification held twice would be counted twice.
         *
         * This is the counts only -- no BKT, no readiness, no mastery rows (see
         * ProgressAnalyticsService.progressFor) -- so it stays a handful of
         * queries per certification rather than the analytics board's work. */
        Set<Long> enrolledCertificationIds = new LinkedHashSet<>();
        for (LearnerCertification enrollment : learnerCertifications) {
            if (enrollment.getStatus() == LearnerCertification.Status.active
                    && enrollment.getCertification() != null) {
                enrolledCertificationIds.add(enrollment.getCertification().getCertificationId());
            }
        }
        for (OrganizationCertificationLearner row : orgCertLearnerEntities) {
            if (row.getStatus() == OrganizationCertificationLearner.Status.active
                    && row.getOrgCert() != null
                    && row.getOrgCert().getCertification() != null) {
                enrolledCertificationIds.add(row.getOrgCert().getCertification().getCertificationId());
            }
        }

        List<CertificationProgressDto> certificationProgress = enrolledCertificationIds.stream()
                .map(certificationId -> progressAnalyticsService.progressFor(learnerId, certificationId))
                .toList();

        return new LearnerPortalDto(
                learnerRepository.findById(learnerId).map(learnerMapper::toDto).orElse(null),
                userRepository.findById(userId).map(userMapper::toDto).orElse(null),
                learnerCertifications.stream()
                        .map(learnerCertificationMapper::toDto).toList(),
                completedLessons.stream()
                        .map(completedLessonMapper::toDto).toList(),
                activityLogRepository.findByUser_UserId(userId).stream()
                        .map(activityLogMapper::toDto).toList(),
                examResultRepository.findByLearner_LearnerId(learnerId).stream()
                        .map(examResultMapper::toDto).toList(),
                orgCertLearnerEntities.stream().map(orgCertLearnerMapper::toDto).toList(),
                orgCertificates,
                achievementAwardService.catalogFor(learnerId),
                totalXp,
                coinBalance,
                aiCreditsRemaining,
                masteryByCertification,
                certificationProgress);
    }
}
