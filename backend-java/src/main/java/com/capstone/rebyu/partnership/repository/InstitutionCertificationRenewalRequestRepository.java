package com.capstone.rebyu.partnership.repository;

import com.capstone.rebyu.partnership.entity.InstitutionCertificationRenewalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InstitutionCertificationRenewalRequestRepository extends JpaRepository<InstitutionCertificationRenewalRequest, Long> {
    List<InstitutionCertificationRenewalRequest> findByOrgCert_OrgCertId(Long orgCertId);
}
