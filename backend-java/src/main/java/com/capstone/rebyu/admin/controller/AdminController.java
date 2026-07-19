package com.capstone.rebyu.admin.controller;

import com.capstone.rebyu.organization.service.OrganizationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
  @Autowired private OrganizationService orgService;

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
}
