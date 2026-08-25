package com.capstone.rebyu.institution.service;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.assessment.mapper.ExamResultMapper;
import com.capstone.rebyu.assessment.repository.ExamResultRepository;
import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enrollment.mapper.OrganizationCertificationLearnerMapper;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
import com.capstone.rebyu.institution.dto.InstitutionPortalDtos.GroupMembershipDto;
import com.capstone.rebyu.institution.dto.InstitutionPortalDtos.LearnerSummaryDto;
import com.capstone.rebyu.institution.dto.InstitutionPortalDtos.OverviewDto;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAssigneeRepository;
import jakarta.persistence.EntityNotFoundException;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.mapper.OrganizationCertificateMapper;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.dto.InstitutionInvoiceDto;
import com.capstone.rebyu.partnership.mapper.InstitutionInvoiceMapper;
import com.capstone.rebyu.partnership.repository.InstitutionInvoiceRepository;
import com.capstone.rebyu.partnership.service.InstitutionInvitationService;
import com.capstone.rebyu.user.repository.LearnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tenant-scoped read model for the institution portal. Every list is filtered to the
 * caller's own institution on the server (never the client), closing the cross-tenant
 * leak where the portal fetched flat global lists and filtered them in the browser.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InstitutionPortalService {

    private final OrganizationCertificateRepository orgCertRepository;
    private final OrganizationCertificateMapper orgCertMapper;
    private final OrganizationCertificationLearnerRepository orgCertLearnerRepository;
    private final OrganizationCertificationLearnerMapper orgCertLearnerMapper;
    private final InstitutionInvoiceRepository invoiceRepository;
    private final InstitutionInvoiceMapper invoiceMapper;
    private final LearnerRepository learnerRepository;
    private final InstitutionInvitationService invitationService;
    private final InstitutionGroupAssigneeRepository groupAssigneeRepository;
    private final ExamResultRepository examResultRepository;
    private final ExamResultMapper examResultMapper;

    public OverviewDto overview(Long institutionId) {
        List<OrganizationCertificateDto> orgCerts =
                orgCertRepository.findByInstitution_InstitutionId(institutionId).stream()
                        .map(orgCertMapper::toDto).toList();

        List<OrganizationCertificationLearner> assignmentEntities =
                orgCertLearnerRepository.findByOrgCert_Institution_InstitutionId(institutionId);
        List<OrganizationCertificationLearnerDto> assignments =
                assignmentEntities.stream().map(orgCertLearnerMapper::toDto).toList();

        Set<Long> learnerIds = assignmentEntities.stream()
                .map(a -> a.getLearner().getLearnerId())
                .collect(Collectors.toSet());
        List<LearnerSummaryDto> learners = learnerIds.isEmpty() ? List.of()
                : learnerRepository.findByLearnerIdIn(learnerIds).stream()
                        .map(l -> new LearnerSummaryDto(l.getLearnerId(), l.getFirstName(), l.getLastName(), l.getUsername()))
                        .toList();

        List<InstitutionInvoiceDto> invoices =
                invoiceRepository.findByInstitution_InstitutionId(institutionId).stream()
                        .map(invoiceMapper::toDto).toList();

        /* Which group each assignment sits in. One query for the whole
           institution rather than one per learner -- the roster names the group
           on every row, and doing that per row is a request per learner. */
        List<GroupMembershipDto> groupMemberships =
                groupAssigneeRepository.assignmentGroupsByInstitution(institutionId).stream()
                        .map(row -> new GroupMembershipDto(
                                row.getOrgCertLearnerId(), row.getInstitutionGroupId(), row.getGroupName()))
                        .toList();

        return new OverviewDto(orgCerts, assignments, learners,
                invitationService.listInvitations(institutionId), invoices, groupMemberships);
    }

    /**
     * Exam results for one learner, but only if that learner actually belongs to the
     * caller's institution. Cross-tenant/unknown learners are reported as "not found"
     * so a manager can't probe or read another organization's learner results.
     */
    public List<ExamResultDto> learnerExamResults(Long institutionId, Long learnerId) {
        if (!orgCertLearnerRepository.existsByLearner_LearnerIdAndOrgCert_Institution_InstitutionId(learnerId, institutionId)) {
            throw new EntityNotFoundException("Learner not found in this organization: " + learnerId);
        }
        return examResultRepository.findByLearner_LearnerId(learnerId).stream()
                .map(examResultMapper::toDto).toList();
    }
}
