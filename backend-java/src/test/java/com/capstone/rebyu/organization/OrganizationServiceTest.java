package com.capstone.rebyu.organization;

import com.capstone.rebyu.organization.entity.Organization;
import com.capstone.rebyu.organization.entity.TeamMember;
import com.capstone.rebyu.organization.repository.OrganizationRepository;
import com.capstone.rebyu.organization.service.OrganizationService;
import com.capstone.rebyu.organization.repository.TeamMemberRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Both tests here previously stubbed nothing at all: they called the service
 * with empty mocks and asserted only that it did not throw. Every repository
 * lookup therefore returned {@code Optional.empty()}, the service's
 * {@code orElseThrow()} fired, and the tests failed -- they had never passed,
 * and would not have caught a regression if they had, since neither one
 * asserted anything the service actually does.
 *
 * <p>They now supply the rows the service reads and assert what it writes.
 */
@ExtendWith(MockitoExtension.class)
public class OrganizationServiceTest {

  @Mock
  private OrganizationRepository orgRepository;

  @Mock
  private TeamMemberRepository teamMemberRepository;

  @Mock
  private LearnerRepository learnerRepository;

  @InjectMocks
  private OrganizationService orgService;

  private static Learner learner(Long id) {
    Learner learner = new Learner();
    learner.setLearnerId(id);
    return learner;
  }

  private static Organization organization(Long id) {
    Organization org = new Organization();
    org.setOrgId(id);
    org.setName("TestOrg");
    org.setDomain("test.com");
    org.setBillingPlan("STARTER");
    org.setSubscriptionStatus("ACTIVE");
    return org;
  }

  @Test
  public void testCreateOrganization() {
    // save() assigns the id, as the database would.
    when(orgRepository.save(any(Organization.class))).thenAnswer(invocation -> {
      Organization saved = invocation.getArgument(0);
      saved.setOrgId(42L);
      return saved;
    });
    when(learnerRepository.findById(1L)).thenReturn(Optional.of(learner(1L)));

    var dto = orgService.createOrganization("TestOrg", "test.com", 1L);

    assertNotNull(dto);
    assertEquals(42L, dto.orgId());
    assertEquals("TestOrg", dto.name());
    assertEquals("test.com", dto.domain());
    assertEquals("STARTER", dto.billingPlan());
    assertEquals("ACTIVE", dto.subscriptionStatus());

    // The creator is enrolled as an accepted admin -- the part of this method
    // that is worth a test, and that the old version never looked at.
    ArgumentCaptor<TeamMember> created = ArgumentCaptor.forClass(TeamMember.class);
    verify(teamMemberRepository).save(created.capture());
    assertEquals("ADMIN", created.getValue().getRole());
    assertEquals("ACCEPTED", created.getValue().getInviteStatus());
    assertEquals(1L, created.getValue().getLearner().getLearnerId());
  }

  @Test
  public void testInviteTeamMember() {
    Organization org = organization(1L);
    TeamMember inviter = new TeamMember();
    inviter.setRole("ADMIN");

    when(orgRepository.findById(1L)).thenReturn(Optional.of(org));
    when(learnerRepository.findById(1L)).thenReturn(Optional.of(learner(1L)));
    when(teamMemberRepository.findByOrganization_OrgIdAndLearner_LearnerId(1L, 1L))
        .thenReturn(Optional.of(inviter));
    when(learnerRepository.findByUser_EmailIgnoreCase("user@example.com"))
        .thenReturn(Optional.of(learner(2L)));

    orgService.inviteTeamMember(1L, "user@example.com", "MEMBER", 1L);

    ArgumentCaptor<TeamMember> invited = ArgumentCaptor.forClass(TeamMember.class);
    verify(teamMemberRepository).save(invited.capture());
    assertEquals("MEMBER", invited.getValue().getRole());
    assertEquals("PENDING", invited.getValue().getInviteStatus());
    assertEquals(2L, invited.getValue().getLearner().getLearnerId());
  }

  @Test
  public void nonAdminCannotInvite() {
    Organization org = organization(1L);
    TeamMember inviter = new TeamMember();
    inviter.setRole("MEMBER");

    when(orgRepository.findById(1L)).thenReturn(Optional.of(org));
    when(learnerRepository.findById(1L)).thenReturn(Optional.of(learner(1L)));
    when(teamMemberRepository.findByOrganization_OrgIdAndLearner_LearnerId(1L, 1L))
        .thenReturn(Optional.of(inviter));

    assertThrows(IllegalArgumentException.class, () ->
        orgService.inviteTeamMember(1L, "user@example.com", "MEMBER", 1L));
    verify(teamMemberRepository, never()).save(any());
    verify(learnerRepository, never()).findByUser_EmailIgnoreCase(anyString());
  }
}
