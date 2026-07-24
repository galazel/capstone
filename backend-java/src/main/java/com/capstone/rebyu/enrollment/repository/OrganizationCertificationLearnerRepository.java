package com.capstone.rebyu.enrollment.repository;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import com.capstone.rebyu.user.entity.Learner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OrganizationCertificationLearnerRepository extends JpaRepository<OrganizationCertificationLearner, Long> {
    boolean existsByOrgCertAndLearner(OrganizationCertificate orgCert, Learner learner);

    List<OrganizationCertificationLearner> findByLearner_LearnerIdAndStatus(
            Long learnerId, OrganizationCertificationLearner.Status status);

    List<OrganizationCertificationLearner> findByLearner_LearnerId(Long learnerId);

    /** All learner allocations under one enterprise — the tenant-scoped portal view. */
    List<OrganizationCertificationLearner> findByOrgCert_Enterprise_EnterpriseId(Long enterpriseId);

    /** True when a learner holds any allocation under the given enterprise (tenant membership check). */
    boolean existsByLearner_LearnerIdAndOrgCert_Enterprise_EnterpriseId(Long learnerId, Long enterpriseId);

    /**
     * True when an organization sponsors this learner into this certification.
     * An org-sponsored learner has no learner_certifications row -- that table
     * is only written by the self-purchase flow -- so any "is this learner
     * enrolled?" check has to consider this table as well, or every enterprise
     * learner looks unenrolled.
     */
    boolean existsByLearner_LearnerIdAndOrgCert_Certification_CertificationIdAndStatus(
            Long learnerId, Long certificationId, OrganizationCertificationLearner.Status status);

    /** Unique active learners under an enterprise — the institutional seat unit. */
    @Query("""
            SELECT COUNT(DISTINCT o.learner.learnerId)
            FROM OrganizationCertificationLearner o
            WHERE o.orgCert.enterprise.enterpriseId = :enterpriseId
              AND o.status = :status
            """)
    long countDistinctActiveLearners(
            @Param("enterpriseId") Long enterpriseId,
            @Param("status") OrganizationCertificationLearner.Status status);
}
