package com.capstone.rebyu.admin.controller;

import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
import com.capstone.rebyu.organization.repository.EnterpriseMemberRepository;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.organization.service.OrganizationService;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {
  private final OrganizationService orgService;
  private final UserRepository userRepository;
  private final EnterpriseRepository enterpriseRepository;
  private final EnterpriseMemberRepository enterpriseMemberRepository;

  @GetMapping("/organizations")
  public ResponseEntity<Map<String, Object>> getAllOrganizations(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int limit) {
    // Return paginated org list with stats
    return ResponseEntity.ok(Map.of(
        "total", 0,
        "page", page,
        "organizations", List.of()
    ));
  }

  @GetMapping("/organizations/{id}/overview")
  public ResponseEntity<Map<String, Object>> getOrgOverview(@PathVariable Long id) {
    return ResponseEntity.ok(Map.of(
        "orgId", id,
        "totalUsers", 0,
        "activeUsers", 0,
        "monthlyRevenue", 0.0,
        "churnRate", 0.0
    ));
  }

  @GetMapping("/users")
  public ResponseEntity<Map<String, Object>> getAllUsers(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int limit) {
    return ResponseEntity.ok(Map.of(
        "total", 0,
        "page", page,
        "users", List.of()
    ));
  }

  @PostMapping("/audit-log")
  public ResponseEntity<List<Map<String, Object>>> getAuditLog(
      @RequestParam(defaultValue = "0") int days) {
    return ResponseEntity.ok(List.of());
  }

  @PostMapping("/fix-my-enterprise-account")
  public ResponseEntity<Map<String, Object>> fixMyEnterpriseAccount(
      @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
    // Enterprise users can self-fix their own account linkage
    if (jwt == null) {
      return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
    }

    String userEmail = jwt.getClaimAsString("email");
    User user = userRepository.findByEmailIgnoreCase(userEmail).orElse(null);

    if (user == null) {
      return ResponseEntity.status(404).body(Map.of("error", "User not found"));
    }

    // Find enterprise with this contact email
    Enterprise enterprise = enterpriseRepository
        .findByPrimaryContactEmailIgnoreCase(userEmail)
        .orElse(null);

    if (enterprise == null) {
      return ResponseEntity.status(404).body(Map.of("error", "No enterprise found for this email"));
    }

    // Check if already linked
    boolean alreadyLinked = !enterpriseMemberRepository
        .findByEnterprise_EnterpriseIdAndUser_UserId(
            enterprise.getEnterpriseId(), user.getUserId())
        .isEmpty();

    if (alreadyLinked) {
      return ResponseEntity.ok(Map.of(
          "success", true,
          "message", "Your account is already linked to " + enterprise.getEnterpriseName()
      ));
    }

    // Create the missing link
    EnterpriseMember member = EnterpriseMember.builder()
        .enterprise(enterprise)
        .user(user)
        .memberRole(EnterpriseMember.MemberRole.owner)
        .isPrimaryContact(true)
        .joinedAt(LocalDateTime.now())
        .build();
    enterpriseMemberRepository.save(member);

    log.info("Enterprise user {} self-linked to enterprise {} (ID: {})",
        userEmail, enterprise.getEnterpriseName(), enterprise.getEnterpriseId());

    return ResponseEntity.ok(Map.of(
        "success", true,
        "message", "Your account has been linked to " + enterprise.getEnterpriseName()
    ));
  }
}
