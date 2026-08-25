package com.capstone.rebyu.organization.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "organization")
public class Organization {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long orgId;

  private String name;
  private String domain;
  private String logoUrl;
  private String subscriptionStatus; // ACTIVE, TRIAL, EXPIRED, CANCELLED
  private Long seatCount = 10L;
  private String billingPlan; // FREE, STARTER, PROFESSIONAL, INSTITUTION
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
  private Boolean isActive = true;
}
