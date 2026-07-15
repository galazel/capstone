package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnterpriseGroupRepository extends JpaRepository<EnterpriseGroup, Long> {
    List<EnterpriseGroup> findByEnterprise_EnterpriseId(Long enterpriseId);

    List<EnterpriseGroup> findByOrgCert_OrgCertId(Long orgCertId);

    long countByEnterprise_EnterpriseIdAndStatus(Long enterpriseId, EnterpriseGroup.Status status);

    boolean existsByCreatedBy_UserId(Long userId);
}
