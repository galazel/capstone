package com.capstone.rebyu.organization.repository;

import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationCertificateRepository extends JpaRepository<OrganizationCertificate, Long> {

    Optional<OrganizationCertificate> findByInstitution_InstitutionIdAndCertification_CertificationId(
            Long institutionId, Long certificationId);

    List<OrganizationCertificate> findByInstitution_InstitutionId(Long institutionId);

    long countByInstitution_InstitutionIdAndStatus(
            Long institutionId, OrganizationCertificate.Status status);
}
