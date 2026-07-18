package com.capstone.rebyu.enterprise.dto;

import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvoiceDto;
import com.capstone.rebyu.partnership.dto.EnterpriseInvitationDtos.InvitationDto;

import java.util.List;

/** Tenant-scoped aggregate for the enterprise portal — everything resolved from the caller's own enterprise. */
public final class EnterprisePortalDtos {

    private EnterprisePortalDtos() {
    }

    public record LearnerSummaryDto(Long learnerId, String firstName, String lastName, String username) {}

    public record OverviewDto(
            List<OrganizationCertificateDto> orgCerts,
            List<OrganizationCertificationLearnerDto> assignments,
            List<LearnerSummaryDto> learners,
            List<InvitationDto> invitations,
            List<EnterpriseInvoiceDto> invoices
    ) {}
}
