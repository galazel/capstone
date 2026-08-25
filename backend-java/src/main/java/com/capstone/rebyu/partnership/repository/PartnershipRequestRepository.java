package com.capstone.rebyu.partnership.repository;

import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PartnershipRequestRepository extends JpaRepository<PartnershipRequest, Long> {

    Optional<PartnershipRequest> findByIdempotencyKey(String idempotencyKey);

    List<PartnershipRequest> findByInstitution_InstitutionIdOrderBySubmittedAtDesc(Long institutionId);

    Optional<PartnershipRequest> findByReferenceNumber(String referenceNumber);

    Optional<PartnershipRequest> findByReferenceNumberAndOrganizationEmailIgnoreCase(
            String referenceNumber, String organizationEmail);

    List<PartnershipRequest> findAllByOrderBySubmittedAtDesc();

    boolean existsByOrganizationEmailIgnoreCaseAndStatus(
            String organizationEmail, PartnershipRequest.Status status);

    long countByStatus(PartnershipRequest.Status status);
}
