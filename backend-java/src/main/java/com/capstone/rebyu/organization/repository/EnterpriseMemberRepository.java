package com.capstone.rebyu.organization.repository;

import com.capstone.rebyu.organization.entity.EnterpriseMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EnterpriseMemberRepository extends JpaRepository<EnterpriseMember, Long> {
    List<EnterpriseMember> findByEnterprise_EnterpriseId(Long enterpriseId);
    List<EnterpriseMember> findByUser_UserId(Long userId);
    List<EnterpriseMember> findByEnterprise_EnterpriseIdAndUser_UserId(Long enterpriseId, Long userId);
}
