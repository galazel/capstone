package com.capstone.rebyu.institutiongroup.repository;

import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InstitutionGroupRepository extends JpaRepository<InstitutionGroup, Long> {
    List<InstitutionGroup> findByInstitution_InstitutionId(Long institutionId);

    List<InstitutionGroup> findByOrgCert_OrgCertId(Long orgCertId);

    long countByInstitution_InstitutionIdAndStatus(Long institutionId, InstitutionGroup.Status status);

    /** Active groups a non-owner institution member is actively authorized to manage. */
    @Query("""
            SELECT DISTINCT g
            FROM InstitutionGroup g
            JOIN InstitutionGroupAuthority a ON a.institutionGroup = g
            WHERE g.institution.institutionId = :institutionId
              AND a.user.userId = :userId
              AND g.status = :groupStatus
              AND a.status = :authorityStatus
            ORDER BY g.createdAt DESC
            """)
    List<InstitutionGroup> findActiveAuthorizedGroups(
            @Param("institutionId") Long institutionId,
            @Param("userId") Long userId,
            @Param("groupStatus") InstitutionGroup.Status groupStatus,
            @Param("authorityStatus") InstitutionGroupAuthority.Status authorityStatus);
}
