package com.capstone.rebyu.billing.repository;

import com.capstone.rebyu.billing.entity.InstitutionalLicense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionalLicenseRepository extends JpaRepository<InstitutionalLicense, Long> {

    List<InstitutionalLicense> findByInstitution_InstitutionIdOrderByCreatedAtDesc(Long institutionId);

    Optional<InstitutionalLicense> findFirstByInstitution_InstitutionIdOrderByCreatedAtDesc(Long institutionId);

    long countByLicenseStatusIn(java.util.Collection<com.capstone.rebyu.billing.entity.BillingStatus> statuses);
}
