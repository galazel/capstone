package com.capstone.rebyu.organization.service;

import com.capstone.rebyu.organization.repository.TeamMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class RoleService {

  @Autowired private TeamMemberRepository teamMemberRepository;

  @Cacheable(value = "userRoles", key = "#learnerId + '_' + #orgId", unless = "#result == null")
  public String getUserRoleInOrg(Long learnerId, Long orgId) {
    return teamMemberRepository.findByOrganization_OrgIdAndLearner_LearnerId(orgId, learnerId)
        .map(tm -> tm.getRole())
        .orElse("GUEST");
  }

  public boolean isAdmin(Long learnerId, Long orgId) {
    return "ADMIN".equals(getUserRoleInOrg(learnerId, orgId));
  }

  public boolean isManagerOrAdmin(Long learnerId, Long orgId) {
    String role = getUserRoleInOrg(learnerId, orgId);
    return "ADMIN".equals(role) || "MANAGER".equals(role);
  }

  public boolean canEditUser(Long actorId, Long targetId, Long orgId) {
    String actorRole = getUserRoleInOrg(actorId, orgId);
    if ("ADMIN".equals(actorRole)) return true;
    if ("MANAGER".equals(actorRole) && actorId.equals(targetId)) return true; // Managers can edit themselves
    return false;
  }
}
