package com.capstone.rebyu.organization.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "team_member")
public class TeamMember {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long teamMemberId;

  @ManyToOne
  @JoinColumn(name = "org_id")
  private Organization organization;

  @ManyToOne
  @JoinColumn(name = "learner_id")
  private Learner learner;

  private String role; // ADMIN, MANAGER, MEMBER
  private String inviteStatus; // PENDING, ACCEPTED, REJECTED
}
