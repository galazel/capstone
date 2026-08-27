package com.capstone.rebyu.institution.service;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institution.dto.InstitutionPortalDtos.OverviewDto;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAssigneeRepository;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.mapper.InstitutionInvoiceMapper;
import com.capstone.rebyu.partnership.repository.InstitutionInvoiceRepository;
import com.capstone.rebyu.partnership.service.InstitutionInvitationService;
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

class InstitutionPortalServiceTest {

    private static final Long INSTITUTION_ID = 7L;

    private OrganizationCertificateRepository orgCertRepository;
    private OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private OrganizationCertificationLearnerMapper orgCertLearnerMapper;
    private InstitutionInvoiceRepository invoiceRepository;
    private LearnerRepository learnerRepository;
    private InstitutionInvitationService invitationService;
    private InstitutionGroupAssigneeRepository groupAssigneeRepository;
    private com.capstone.rebyu.assessment.repository.ExamResultRepository examResultRepository;
    private InstitutionPortalService service;

    @BeforeEach
    void setUp() {
        orgCertRepository = mock(OrganizationCertificateRepository.class);
        orgCertLearnerRepository = mock(OrganizationCertificationLearnerRepository.class);
        orgCertLearnerMapper = mock(OrganizationCertificationLearnerMapper.class);
        invoiceRepository = mock(InstitutionInvoiceRepository.class);
        learnerRepository = mock(LearnerRepository.class);
        invitationService = mock(InstitutionInvitationService.class);
        groupAssigneeRepository = mock(InstitutionGroupAssigneeRepository.class);
        examResultRepository = mock(com.capstone.rebyu.assessment.repository.ExamResultRepository.class);
        service = new InstitutionPortalService(orgCertRepository, mock(OrganizationCertificateMapper.class),
                orgCertLearnerRepository, orgCertLearnerMapper, invoiceRepository,
                mock(InstitutionInvoiceMapper.class), learnerRepository, invitationService,
                groupAssigneeRepository, examResultRepository,
                mock(com.capstone.rebyu.assessment.mapper.ExamResultMapper.class));

        when(orgCertRepository.findByInstitution_InstitutionId(INSTITUTION_ID)).thenReturn(List.of());
        when(invoiceRepository.findByInstitution_InstitutionId(INSTITUTION_ID)).thenReturn(List.of());
        when(invitationService.listInvitations(INSTITUTION_ID)).thenReturn(List.of());
        /* Stubbed, not left as a bare mock: `overview` streams this result
           straight away, so the default null would NPE before any assertion in
           these tests is reached. Empty is also the honest default here -- these
           tests are about which learners are fetched, not about grouping. */
        when(groupAssigneeRepository.assignmentGroupsByInstitution(INSTITUTION_ID)).thenReturn(List.of());
    }

    private OrganizationCertificationLearner assignment(Long learnerId) {
        OrganizationCertificationLearner row = new OrganizationCertificationLearner();
        row.setLearner(Learner.builder().learnerId(learnerId).build());
        return row;
    }

    @Test
    void overview_fetchesLearnersOnlyForThisInstitutionsAssignments() {
        when(orgCertLearnerRepository.findByOrgCert_Institution_InstitutionId(INSTITUTION_ID))
                .thenReturn(List.of(assignment(11L), assignment(22L), assignment(11L)));
        when(learnerRepository.findByLearnerIdIn(any())).thenReturn(List.of(
                Learner.builder().learnerId(11L).firstName("Ana").lastName("Cruz").username("ana").build(),
                Learner.builder().learnerId(22L).firstName("Ben").lastName("Diaz").username("ben").build()));

        OverviewDto result = service.overview(INSTITUTION_ID);

        // Deduped learner ids from this institution's assignments only -- never a global fetch.
        verify(learnerRepository).findByLearnerIdIn(Set.of(11L, 22L));
        verify(learnerRepository, never()).findAll();
        assertEquals(2, result.learners().size());
    }

    @Test
    void overview_noAssignments_skipsLearnerLookupEntirely() {
        when(orgCertLearnerRepository.findByOrgCert_Institution_InstitutionId(INSTITUTION_ID)).thenReturn(List.of());

        OverviewDto result = service.overview(INSTITUTION_ID);

        verify(learnerRepository, never()).findByLearnerIdIn(any());
        assertTrue(result.learners().isEmpty());
    }

    @Test
    void overview_usesInstitutionScopedRepositoryQueries_notGlobalFindAll() {
        when(orgCertLearnerRepository.findByOrgCert_Institution_InstitutionId(INSTITUTION_ID)).thenReturn(List.of());

        service.overview(INSTITUTION_ID);

        verify(orgCertRepository).findByInstitution_InstitutionId(eq(INSTITUTION_ID));
        verify(orgCertRepository, never()).findAll();
        verify(invoiceRepository).findByInstitution_InstitutionId(eq(INSTITUTION_ID));
        verify(invoiceRepository, never()).findAll();
    }

    @Test
    void learnerExamResults_learnerNotInInstitution_throwsNotFoundWithoutReadingResults() {
        Long otherLearnerId = 999L;
        when(orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Institution_InstitutionId(otherLearnerId, INSTITUTION_ID))
                .thenReturn(false);

        assertThrows(jakarta.persistence.EntityNotFoundException.class,
                () -> service.learnerExamResults(INSTITUTION_ID, otherLearnerId));
        verify(examResultRepository, never()).findByLearner_LearnerId(any());
    }

    @Test
    void learnerExamResults_learnerInInstitution_returnsScopedResults() {
        Long learnerId = 55L;
        when(orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Institution_InstitutionId(learnerId, INSTITUTION_ID))
                .thenReturn(true);
        when(examResultRepository.findByLearner_LearnerId(learnerId)).thenReturn(List.of());

        service.learnerExamResults(INSTITUTION_ID, learnerId);

        verify(examResultRepository).findByLearner_LearnerId(learnerId);
        verify(examResultRepository, never()).findAll();
    }
}
