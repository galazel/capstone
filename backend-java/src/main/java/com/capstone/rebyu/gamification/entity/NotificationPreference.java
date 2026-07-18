package com.capstone.rebyu.gamification.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "notification_preference")
public class NotificationPreference {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long prefId;

  @OneToOne
  @JoinColumn(name = "learner_id")
  private Learner learner;

  private Boolean dailyReminder = true;
  private String dailyReminderTime = "09:00";
  private Boolean streakReminder = true;
  private Boolean socialNotifications = true;
  private Boolean achievementNotifications = true;
}
