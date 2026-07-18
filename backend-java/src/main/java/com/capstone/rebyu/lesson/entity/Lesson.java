package com.capstone.rebyu.lesson.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "lesson")
public class Lesson {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long lessonId;

  private String title;
  private String description;
  private Long certificationId;
  private LocalDateTime completedAt;
  private Boolean isActive = true;
  private LocalDateTime createdAt;
}
