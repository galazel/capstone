package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EnterpriseGroupRepository extends JpaRepository<EnterpriseGroup, Long> {
    List<EnterpriseGroup> findByEnterprise_EnterpriseId(Long enterpriseId);

    List<EnterpriseGroup> findByOrgCert_OrgCertId(Long orgCertId);

    long countByEnterprise_EnterpriseIdAndStatus(Long enterpriseId, EnterpriseGroup.Status status);

    /** Active groups a non-owner enterprise member is actively authorized to manage. */
    @Query("""
            SELECT DISTINCT g
            FROM EnterpriseGroup g
            JOIN EnterpriseGroupAuthority a ON a.enterpriseGroup = g
            WHERE g.enterprise.enterpriseId = :enterpriseId
              AND a.user.userId = :userId
              AND g.status = :groupStatus
              AND a.status = :authorityStatus
            ORDER BY g.createdAt DESC
            """)
    List<EnterpriseGroup> findActiveAuthorizedGroups(
            @Param("enterpriseId") Long enterpriseId,
            @Param("userId") Long userId,
            @Param("groupStatus") EnterpriseGroup.Status groupStatus,
            @Param("authorityStatus") EnterpriseGroupAuthority.Status authorityStatus);
}
