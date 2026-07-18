package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.assessment.mapper.ExamResultMapper;
import com.capstone.rebyu.assessment.repository.ExamResultRepository;
import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.enterprise.dto.EnterprisePortalDtos.LearnerSummaryDto;
import com.capstone.rebyu.enterprise.dto.EnterprisePortalDtos.OverviewDto;
import jakarta.persistence.EntityNotFoundException;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.dto.EnterpriseInvoiceDto;
import com.capstone.rebyu.partnership.mapper.EnterpriseInvoiceMapper;
import com.capstone.rebyu.partnership.repository.EnterpriseInvoiceRepository;
import com.capstone.rebyu.partnership.service.EnterpriseInvitationService;
import com.capstone.rebyu.user.repository.LearnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tenant-scoped read model for the enterprise portal. Every list is filtered to the
 * caller's own enterprise on the server (never the client), closing the cross-tenant
 * leak where the portal fetched flat global lists and filtered them in the browser.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnterprisePortalService {

    private final OrganizationCertificateRepository orgCertRepository;
    private final OrganizationCertificateMapper orgCertMapper;
    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final OrganizationCertificationLearnerMapper orgCertLearnerMapper;
    private final EnterpriseInvoiceRepository invoiceRepository;
    private final EnterpriseInvoiceMapper invoiceMapper;
    private final LearnerRepository learnerRepository;
    private final EnterpriseInvitationService invitationService;
    private final ExamResultRepository examResultRepository;
    private final ExamResultMapper examResultMapper;

    public OverviewDto overview(Long enterpriseId) {
        List<OrganizationCertificateDto> orgCerts =
                orgCertRepository.findByEnterprise_EnterpriseId(enterpriseId).stream()
                        .map(orgCertMapper::toDto).toList();

        List<OrganizationCertificationLearner> assignmentEntities =
                orgCertLearnerRepository.findByOrgCert_Enterprise_EnterpriseId(enterpriseId);
        List<OrganizationCertificationLearnerDto> assignments =
                assignmentEntities.stream().map(orgCertLearnerMapper::toDto).toList();

        Set<Long> learnerIds = assignmentEntities.stream()
                .map(a -> a.getLearner().getLearnerId())
                .collect(Collectors.toSet());
        List<LearnerSummaryDto> learners = learnerIds.isEmpty() ? List.of()
                : learnerRepository.findByLearnerIdIn(learnerIds).stream()
                        .map(l -> new LearnerSummaryDto(l.getLearnerId(), l.getFirstName(), l.getLastName(), l.getUsername()))
                        .toList();

        List<EnterpriseInvoiceDto> invoices =
                invoiceRepository.findByEnterprise_EnterpriseId(enterpriseId).stream()
                        .map(invoiceMapper::toDto).toList();

        return new OverviewDto(orgCerts, assignments, learners,
                invitationService.listInvitations(enterpriseId), invoices);
    }

    /**
     * Exam results for one learner, but only if that learner actually belongs to the
     * caller's enterprise. Cross-tenant/unknown learners are reported as "not found"
     * so a manager can't probe or read another organization's learner results.
     */
    public List<ExamResultDto> learnerExamResults(Long enterpriseId, Long learnerId) {
        if (!orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Enterprise_EnterpriseId(learnerId, enterpriseId)) {
            throw new EntityNotFoundException("Learner not found in this organization: " + learnerId);
        }
        return examResultRepository.findByLearner_LearnerId(learnerId).stream()
                .map(examResultMapper::toDto).toList();
    }
}
