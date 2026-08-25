package com.capstone.rebyu.institutiongroup.repository;

import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import com.capstone.rebyu.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InstitutionGroupAuthorityRepository extends JpaRepository<InstitutionGroupAuthority, Long> {
    List<InstitutionGroupAuthority> findByInstitutionGroup_InstitutionGroupId(Long institutionGroupId);

    List<InstitutionGroupAuthority> findByUser_UserId(Long userId);

    boolean existsByInstitutionGroupAndUserAndStatus(
            InstitutionGroup institutionGroup, User user, InstitutionGroupAuthority.Status status);

    /**
     * Finds any existing membership (active or archived) for this (group, user) pair,
     * regardless of status, so re-assignment can reactivate an archived row in place
     * instead of inserting a logically duplicate one.
     */
    Optional<InstitutionGroupAuthority> findByInstitutionGroupAndUser(InstitutionGroup institutionGroup, User user);

    /** Distinct active authority users across all of an institution's groups. */
    @Query("""
            SELECT COUNT(DISTINCT a.user.userId)
            FROM InstitutionGroupAuthority a
            WHERE a.institutionGroup.institution.institutionId = :institutionId
              AND a.status = :status
            """)
    long countDistinctActiveAuthorities(
            @Param("institutionId") Long institutionId,
            @Param("status") InstitutionGroupAuthority.Status status);
}
