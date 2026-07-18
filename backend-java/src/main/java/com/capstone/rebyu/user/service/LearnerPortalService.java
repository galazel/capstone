package com.capstone.rebyu.user.service;

import com.capstone.rebyu.assessment.mapper.ExamResultMapper;
import com.capstone.rebyu.assessment.repository.ExamResultRepository;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.LearnerCertificationMapper;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.progress.mapper.ActivityLogMapper;
import com.capstone.rebyu.progress.mapper.LearnerCompletedLessonMapper;
import com.capstone.rebyu.progress.repository.ActivityLogRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
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
import java.util.List;
import java.util.Map;

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

    public LearnerDto currentLearner(Long learnerId) {
        return learnerRepository.findById(learnerId).map(learnerMapper::toDto).orElse(null);
    }

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

        // Fetch XP and coins (stubbed for now - would come from gamification service)
        Long totalXp = 0L;
        java.math.BigDecimal coinBalance = java.math.BigDecimal.ZERO;
        Long aiCreditsRemaining = 0L;

        // Fetch BKT mastery state per certification (stubbed for now)
        Map<Long, Integer> masteryByCertification = new java.util.HashMap<>();

        return new LearnerPortalDto(
                learnerRepository.findById(learnerId).map(learnerMapper::toDto).orElse(null),
                userRepository.findById(userId).map(userMapper::toDto).orElse(null),
                learnerCertificationRepository.findByLearner_LearnerId(learnerId).stream()
                        .map(learnerCertificationMapper::toDto).toList(),
                completedLessonRepository.findByLearner_LearnerId(learnerId).stream()
                        .map(completedLessonMapper::toDto).toList(),
                activityLogRepository.findByUser_UserId(userId).stream()
                        .map(activityLogMapper::toDto).toList(),
                examResultRepository.findByLearner_LearnerId(learnerId).stream()
                        .map(examResultMapper::toDto).toList(),
                orgCertLearnerEntities.stream().map(orgCertLearnerMapper::toDto).toList(),
                orgCertificates,
                totalXp,
                coinBalance,
                aiCreditsRemaining,
                masteryByCertification);
    }
}
