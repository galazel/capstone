package com.capstone.rebyu.gamification.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "study_plan")
public class StudyPlan {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long planId;

  @ManyToOne
  @JoinColumn(name = "learner_id")
  private Learner learner;

  /**
   * The certification this plan reviews for. A plain id rather than a relation:
   * the plan is only ever read back for one certification at a time, and the
   * association would drag a Certification fetch into every read for nothing.
   * Nullable, since plans predating the per-certification flow have none.
   */
  @Column(name = "certification_id")
  private Long certificationId;

  private String goal;

  /**
   * The generated plan as JSON -- preferences plus every scheduled event.
   * TEXT, not the default VARCHAR(255): a plan runs to dozens of events and
   * would be rejected outright at that length.
   */
  @Column(columnDefinition = "TEXT")
  private String schedule;

  private LocalDateTime createdAt;
  private LocalDateTime completedAt;
  private String status; // ACTIVE, COMPLETED, ABANDONED
}
