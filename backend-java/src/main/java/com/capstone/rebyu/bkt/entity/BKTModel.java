package com.capstone.rebyu.bkt.entity;

import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.certification.entity.Certification;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "bkt_model", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"learner_id", "certification_id"})
})
public class BKTModel {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long bktId;

  @ManyToOne
  @JoinColumn(name = "learner_id")
  private Learner learner;

  @ManyToOne
  @JoinColumn(name = "certification_id")
  private Certification certification;

  // Knowledge state: probability that learner knows this skill (0.0 - 1.0)
  private Double pKnow = 0.0;

  // Mastery level: 0-4 derived from pKnow
  private Integer masteryLevel = 0;

  // BKT parameters (can be tuned per skill)
  private Double pTransit = 0.1;    // Probability of learning per exposure
  private Double pGuess = 0.2;      // Probability of guessing correctly
  private Double pSlip = 0.05;      // Probability of careless error

  // Tracking
  private Integer assessmentsAttempted = 0;
  private Integer correctCount = 0;
  private LocalDateTime lastUpdated;
  private LocalDateTime createdAt;

  // State tracking
  private Boolean isActive = true;
}
