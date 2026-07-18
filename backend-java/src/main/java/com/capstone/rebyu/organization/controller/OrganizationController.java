package com.capstone.rebyu.organization.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.organization.service.OrganizationService;
import com.capstone.rebyu.organization.service.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.preauthorize.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {
  @Autowired private OrganizationService orgService;
  @Autowired private RoleService roleService;

  @PostMapping
  @PreAuthorize("hasRole('LEARNER')")
  @ResponseStatus(HttpStatus.CREATED)
  public OrganizationService.OrganizationDto createOrganization(
      @RequestBody Map<String, String> request,
      @RequestAttribute CurrentUserDto currentUser) {
    return orgService.createOrganization(request.get("name"), request.get("domain"), currentUser.getLearnerId());
  }

  @GetMapping("/{id}")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<OrganizationService.OrganizationDto> getOrganization(
      @PathVariable Long id,
      @RequestAttribute CurrentUserDto currentUser) {
    // Check access
    return ResponseEntity.ok(orgService.getOrganization(id));
  }

  @PostMapping("/{id}/invite")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> inviteTeamMember(
      @PathVariable Long id,
      @RequestBody Map<String, String> request,
      @RequestAttribute CurrentUserDto currentUser) {
    orgService.inviteTeamMember(id, request.get("email"), request.get("role"), currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }

  @GetMapping("/{id}/members")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<List<OrganizationService.TeamMemberDto>> getTeamMembers(
      @PathVariable Long id,
      @RequestAttribute CurrentUserDto currentUser) {
    return ResponseEntity.ok(orgService.getTeamMembers(id));
  }
}
