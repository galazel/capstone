package com.capstone.rebyu.gamification.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "streak")
public class Streak {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long streakId;

  @OneToOne
  @JoinColumn(name = "learner_id")
  private Learner learner;

  private Integer currentStreak = 0;
  private Integer bestStreak = 0;
  private LocalDate lastActivityDate;
  private LocalDate streakStartDate;
}
