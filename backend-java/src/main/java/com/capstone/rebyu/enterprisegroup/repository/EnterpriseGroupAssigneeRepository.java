package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enrollment.entity.OrganizationCertificationLearner;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnterpriseGroupAssigneeRepository extends JpaRepository<EnterpriseGroupAssignee, Long> {
    List<EnterpriseGroupAssignee> findByEnterpriseGroup_EnterpriseGroupId(Long enterpriseGroupId);

    boolean existsByEnterpriseGroupAndOrgCertLearner(
            EnterpriseGroup enterpriseGroup, OrganizationCertificationLearner orgCertLearner);

    // Regardless of status -- used to reactivate an archived assignment
    // instead of colliding with it on re-add.
    Optional<EnterpriseGroupAssignee> findByEnterpriseGroupAndOrgCertLearner(
            EnterpriseGroup enterpriseGroup, OrganizationCertificationLearner orgCertLearner);
}
