package com.capstone.rebyu.enterprise.service;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.enterprise.dto.EnterprisePortalDtos.OverviewDto;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.mapper.EnterpriseInvoiceMapper;
import com.capstone.rebyu.partnership.repository.EnterpriseInvoiceRepository;
import com.capstone.rebyu.partnership.service.EnterpriseInvitationService;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EnterprisePortalServiceTest {

    private static final Long ENTERPRISE_ID = 7L;

    private OrganizationCertificateRepository orgCertRepository;
    private OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private OrganizationCertificationLearnerMapper orgCertLearnerMapper;
    private EnterpriseInvoiceRepository invoiceRepository;
    private LearnerRepository learnerRepository;
    private EnterpriseInvitationService invitationService;
    private com.capstone.rebyu.assessment.repository.ExamResultRepository examResultRepository;
    private EnterprisePortalService service;

    @BeforeEach
    void setUp() {
        orgCertRepository = mock(OrganizationCertificateRepository.class);
        orgCertLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);
        orgCertLearnerMapper = mock(OrganizationCertificationLearnerMapper.class);
        invoiceRepository = mock(EnterpriseInvoiceRepository.class);
        learnerRepository = mock(LearnerRepository.class);
        invitationService = mock(EnterpriseInvitationService.class);
        examResultRepository = mock(com.capstone.rebyu.assessment.repository.ExamResultRepository.class);
        service = new EnterprisePortalService(orgCertRepository, mock(OrganizationCertificateMapper.class),
                orgCertLearnerRepository, orgCertLearnerMapper, invoiceRepository,
                mock(EnterpriseInvoiceMapper.class), learnerRepository, invitationService,
                examResultRepository, mock(com.capstone.rebyu.assessment.mapper.ExamResultMapper.class));

        when(orgCertRepository.findByEnterprise_EnterpriseId(ENTERPRISE_ID)).thenReturn(List.of());
        when(invoiceRepository.findByEnterprise_EnterpriseId(ENTERPRISE_ID)).thenReturn(List.of());
        when(invitationService.listInvitations(ENTERPRISE_ID)).thenReturn(List.of());
    }

    private OrganizationCertificationLearner assignment(Long learnerId) {
        OrganizationCertificationLearner row = new OrganizationCertificationLearner();
        row.setLearner(Learner.builder().learnerId(learnerId).build());
        return row;
    }

    @Test
    void overview_fetchesLearnersOnlyForThisEnterprisesAssignments() {
        when(orgCertLearnerRepository.findByOrgCert_Enterprise_EnterpriseId(ENTERPRISE_ID))
                .thenReturn(List.of(assignment(11L), assignment(22L), assignment(11L)));
        when(learnerRepository.findByLearnerIdIn(any())).thenReturn(List.of(
                Learner.builder().learnerId(11L).firstName("Ana").lastName("Cruz").username("ana").build(),
                Learner.builder().learnerId(22L).firstName("Ben").lastName("Diaz").username("ben").build()));

        OverviewDto result = service.overview(ENTERPRISE_ID);

        // Deduped learner ids from this enterprise's assignments only -- never a global fetch.
        verify(learnerRepository).findByLearnerIdIn(Set.of(11L, 22L));
        verify(learnerRepository, never()).findAll();
        assertEquals(2, result.learners().size());
    }

    @Test
    void overview_noAssignments_skipsLearnerLookupEntirely() {
        when(orgCertLearnerRepository.findByOrgCert_Enterprise_EnterpriseId(ENTERPRISE_ID)).thenReturn(List.of());

        OverviewDto result = service.overview(ENTERPRISE_ID);

        verify(learnerRepository, never()).findByLearnerIdIn(any());
        assertTrue(result.learners().isEmpty());
    }

    @Test
    void overview_usesEnterpriseScopedRepositoryQueries_notGlobalFindAll() {
        when(orgCertLearnerRepository.findByOrgCert_Enterprise_EnterpriseId(ENTERPRISE_ID)).thenReturn(List.of());

        service.overview(ENTERPRISE_ID);

        verify(orgCertRepository).findByEnterprise_EnterpriseId(eq(ENTERPRISE_ID));
        verify(orgCertRepository, never()).findAll();
        verify(invoiceRepository).findByEnterprise_EnterpriseId(eq(ENTERPRISE_ID));
        verify(invoiceRepository, never()).findAll();
    }

    @Test
    void learnerExamResults_learnerNotInEnterprise_throwsNotFoundWithoutReadingResults() {
        Long otherLearnerId = 999L;
        when(orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Enterprise_EnterpriseId(otherLearnerId, ENTERPRISE_ID))
                .thenReturn(false);

        assertThrows(jakarta.persistence.EntityNotFoundException.class,
                () -> service.learnerExamResults(ENTERPRISE_ID, otherLearnerId));
        verify(examResultRepository, never()).findByLearner_LearnerId(any());
    }

    @Test
    void learnerExamResults_learnerInEnterprise_returnsScopedResults() {
        Long learnerId = 55L;
        when(orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Enterprise_EnterpriseId(learnerId, ENTERPRISE_ID))
                .thenReturn(true);
        when(examResultRepository.findByLearner_LearnerId(learnerId)).thenReturn(List.of());

        service.learnerExamResults(ENTERPRISE_ID, learnerId);

        verify(examResultRepository).findByLearner_LearnerId(learnerId);
        verify(examResultRepository, never()).findAll();
    }
}
