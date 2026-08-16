package com.capstone.rebyu.progress.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "achievements")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Achievement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long achievementId;

    @Column(nullable = false, unique = true, length = 100)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

}
