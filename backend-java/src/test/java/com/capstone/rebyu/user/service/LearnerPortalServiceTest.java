package com.capstone.rebyu.user.service;

import com.capstone.rebyu.assessment.mapper.ExamResultMapper;
import com.capstone.rebyu.assessment.repository.ExamResultRepository;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.LearnerCertificationMapper;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.progress.mapper.ActivityLogMapper;
import com.capstone.rebyu.progress.mapper.LearnerCompletedLessonMapper;
import com.capstone.rebyu.progress.repository.ActivityLogRepository;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.user.dto.LearnerPortalDto;
import com.capstone.rebyu.user.mapper.LearnerMapper;
import com.capstone.rebyu.user.mapper.UserMapper;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LearnerPortalServiceTest {

    private static final Long LEARNER_ID = 3L;
    private static final Long USER_ID = 9L;

    private LearnerRepository learnerRepository;
    private UserRepository userRepository;
    private LearnerCertificationRepository learnerCertRepository;
    private LearnerCompletedLessonRepository completedLessonRepository;
    private ActivityLogRepository activityLogRepository;
    private ExamResultRepository examResultRepository;
    private OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private OrganizationCertificateMapper orgCertMapper;
    private LearnerPortalService service;

    @BeforeEach
    void setUp() {
        learnerRepository = mock(LearnerRepository.class);
        userRepository = mock(UserRepository.class);
        learnerCertRepository = mock(LearnerCertificationRepository.class);
        completedLessonRepository = mock(LearnerCompletedLessonRepository.class);
        activityLogRepository = mock(ActivityLogRepository.class);
        examResultRepository = mock(ExamResultRepository.class);
        orgCertLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);
        orgCertMapper = mock(OrganizationCertificateMapper.class);

        service = new LearnerPortalService(learnerRepository, mock(LearnerMapper.class), userRepository,
                mock(UserMapper.class), learnerCertRepository, mock(LearnerCertificationMapper.class),
                completedLessonRepository, mock(LearnerCompletedLessonMapper.class), activityLogRepository,
                mock(ActivityLogMapper.class), examResultRepository, mock(ExamResultMapper.class),
                orgCertLearnerRepository, mock(OrganizationCertificationLearnerMapper.class), orgCertMapper);

        when(learnerRepository.findById(LEARNER_ID)).thenReturn(Optional.empty());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(learnerCertRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());
        when(completedLessonRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());
        when(activityLogRepository.findByUser_UserId(USER_ID)).thenReturn(List.of());
        when(examResultRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());
        when(orgCertMapper.toDto(any())).thenReturn(null);
    }

    private OrganizationCertificationLearner assignmentWithOrgCert(Long orgCertId) {
        OrganizationCertificate orgCert = new OrganizationCertificate();
        orgCert.setOrgCertId(orgCertId);
        OrganizationCertificationLearner row = new OrganizationCertificationLearner();
        row.setOrgCert(orgCert);
        return row;
    }

    @Test
    void portal_usesScopedFinders_neverGlobalFindAll() {
        when(orgCertLearnerRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());

        service.portal(LEARNER_ID, USER_ID);

        verify(examResultRepository).findByLearner_LearnerId(LEARNER_ID);
        verify(examResultRepository, never()).findAll();
        verify(completedLessonRepository).findByLearner_LearnerId(LEARNER_ID);
        verify(completedLessonRepository, never()).findAll();
        verify(activityLogRepository).findByUser_UserId(USER_ID);
        verify(activityLogRepository, never()).findAll();
        verify(orgCertLearnerRepository, never()).findAll();
    }

    @Test
    void portal_orgCertificatesAreDedupedFromLearnersOwnAssignments() {
        when(orgCertLearnerRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of(
                assignmentWithOrgCert(100L), assignmentWithOrgCert(200L), assignmentWithOrgCert(100L)));

        LearnerPortalDto result = service.portal(LEARNER_ID, USER_ID);

        // Two distinct org certs (100, 200) -- the duplicate 100 is collapsed, and only
        // the learner's own allocations are mapped (never a global org-cert fetch).
        assertEquals(2, result.orgCertificates().size());
        verify(orgCertMapper, org.mockito.Mockito.times(2)).toDto(any());
    }

    @Test
    void portal_noAssignments_returnsEmptyOrgCertificates() {
        when(orgCertLearnerRepository.findByLearner_LearnerId(LEARNER_ID)).thenReturn(List.of());

        LearnerPortalDto result = service.portal(LEARNER_ID, USER_ID);

        assertEquals(0, result.orgCertificates().size());
        assertEquals(0, result.orgCertLearners().size());
    }
}
