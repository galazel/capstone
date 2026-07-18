package com.capstone.rebyu.organization;

import com.capstone.rebyu.organization.entity.Organization;
import com.capstone.rebyu.organization.repository.OrganizationRepository;
import com.capstone.rebyu.organization.service.OrganizationService;
import com.capstone.rebyu.organization.repository.TeamMemberRepository;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

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

  @Test
  public void testCreateOrganization() {
    // Create org
    var dto = orgService.createOrganization("TestOrg", "test.com", 1L);

    // Verify
    assertNotNull(dto);
    assertEquals("TestOrg", dto.name());
    assertEquals("test.com", dto.domain());
  }

  @Test
  public void testInviteTeamMember() {
    // Invite user
    assertDoesNotThrow(() -> {
      orgService.inviteTeamMember(1L, "user@example.com", "MEMBER", 1L);
    });
  }
}
