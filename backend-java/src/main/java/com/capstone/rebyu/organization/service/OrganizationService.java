package com.capstone.rebyu.organization.service;

import com.capstone.rebyu.organization.entity.Organization;
import com.capstone.rebyu.organization.entity.TeamMember;
import com.capstone.rebyu.organization.repository.OrganizationRepository;
import com.capstone.rebyu.organization.repository.TeamMemberRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrganizationService {

  @Autowired private OrganizationRepository orgRepository;
  @Autowired private TeamMemberRepository teamMemberRepository;
  @Autowired private LearnerRepository learnerRepository;

  public record OrganizationDto(Long orgId, String name, String domain, String billingPlan, String subscriptionStatus, Long seatCount) {}
  public record TeamMemberDto(Long teamMemberId, String learnerName, String email, String role, String inviteStatus) {}

  @Transactional
  public OrganizationDto createOrganization(String name, String domain, Long creatorId) {
    Organization org = new Organization();
    org.setName(name);
    org.setDomain(domain);
    org.setSubscriptionStatus("ACTIVE");
    org.setBillingPlan("STARTER");
    org.setCreatedAt(LocalDateTime.now());
    Organization saved = orgRepository.save(org);

    // Make creator admin
    Learner creator = learnerRepository.findById(creatorId).orElseThrow();
    TeamMember admin = new TeamMember();
    admin.setOrganization(saved);
    admin.setLearner(creator);
    admin.setRole("ADMIN");
    admin.setInviteStatus("ACCEPTED");
    teamMemberRepository.save(admin);

    return toOrgDto(saved);
  }

  @Transactional
  public void inviteTeamMember(Long orgId, String inviteEmail, String role, Long inviterId) {
    Organization org = orgRepository.findById(orgId).orElseThrow();

    // Verify inviter is admin
    Learner inviter = learnerRepository.findById(inviterId).orElseThrow();
    TeamMember inviterMember = teamMemberRepository.findByOrganization_OrgIdAndLearner_LearnerId(orgId, inviterId)
        .orElseThrow(() -> new IllegalArgumentException("Inviter not in org"));
    if (!inviterMember.getRole().equals("ADMIN")) {
      throw new IllegalArgumentException("Only admins can invite");
    }

    // Create invite (in production, send email with invite link)
    Learner invitedUser = learnerRepository.findByUser_EmailIgnoreCase(inviteEmail)
        .orElseThrow(() -> new IllegalArgumentException("User not found"));

    TeamMember member = new TeamMember();
    member.setOrganization(org);
    member.setLearner(invitedUser);
    member.setRole(role);
    member.setInviteStatus("PENDING");
    teamMemberRepository.save(member);
  }

  public List<TeamMemberDto> getTeamMembers(Long orgId) {
    return teamMemberRepository.findByOrganization_OrgIdOrderByLearner_LearnerId(orgId).stream()
        .map(tm -> new TeamMemberDto(
            tm.getTeamMemberId(),
            tm.getLearner().getFirstName() + " " + tm.getLearner().getLastName(),
            tm.getLearner().getUser() != null ? tm.getLearner().getUser().getEmail() : null,
            tm.getRole(),
            tm.getInviteStatus()
        ))
        .toList();
  }

  public OrganizationDto getOrganization(Long orgId) {
    return toOrgDto(orgRepository.findById(orgId).orElseThrow());
  }

  private OrganizationDto toOrgDto(Organization org) {
    return new OrganizationDto(org.getOrgId(), org.getName(), org.getDomain(), org.getBillingPlan(), org.getSubscriptionStatus(), org.getSeatCount());
  }
}
