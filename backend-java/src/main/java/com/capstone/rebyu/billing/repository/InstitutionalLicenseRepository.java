package com.capstone.rebyu.billing.repository;

import com.capstone.rebyu.billing.entity.InstitutionalLicense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionalLicenseRepository extends JpaRepository<InstitutionalLicense, Long> {

    List<InstitutionalLicense> findByEnterprise_EnterpriseIdOrderByCreatedAtDesc(Long enterpriseId);

    Optional<InstitutionalLicense> findFirstByEnterprise_EnterpriseIdOrderByCreatedAtDesc(Long enterpriseId);

    long countByLicenseStatusIn(java.util.Collection<com.capstone.rebyu.billing.entity.BillingStatus> statuses);
}
