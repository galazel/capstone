package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import com.capstone.rebyu.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnterpriseGroupAuthorityRepository extends JpaRepository<EnterpriseGroupAuthority, Long> {
    List<EnterpriseGroupAuthority> findByEnterpriseGroup_EnterpriseGroupId(Long enterpriseGroupId);

    List<EnterpriseGroupAuthority> findByUser_UserId(Long userId);

    boolean existsByEnterpriseGroupAndUserAndStatus(
            EnterpriseGroup enterpriseGroup, User user, EnterpriseGroupAuthority.Status status);

    /**
     * Finds any existing membership (active or archived) for this (group, user) pair,
     * regardless of status, so re-assignment can reactivate an archived row in place
     * instead of inserting a logically duplicate one.
     */
    Optional<EnterpriseGroupAuthority> findByEnterpriseGroupAndUser(EnterpriseGroup enterpriseGroup, User user);

    /** Distinct active authority users across all of an enterprise's groups. */
    @Query("""
            SELECT COUNT(DISTINCT a.user.userId)
            FROM EnterpriseGroupAuthority a
            WHERE a.enterpriseGroup.enterprise.enterpriseId = :enterpriseId
              AND a.status = :status
            """)
    long countDistinctActiveAuthorities(
            @Param("enterpriseId") Long enterpriseId,
            @Param("status") EnterpriseGroupAuthority.Status status);
}
