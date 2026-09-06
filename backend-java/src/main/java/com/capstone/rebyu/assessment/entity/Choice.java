package com.capstone.rebyu.assessment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "choices",
        /* Loaded once per paper as `question_id IN (...)`; unindexed that is a
           full scan of the choice table for every assessment opened. */
        indexes = @Index(name = "ix_choice_question", columnList = "question_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Choice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long choiceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String choiceText;

    @Column(name = "image_key", length = 255)
    private String imageKey;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(columnDefinition = "TEXT")
    private String explanation;

}
