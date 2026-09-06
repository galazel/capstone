package com.capstone.rebyu.assessment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Table(
        name = "exam_questions",
        /* The exam's authored question list, read on every start and on every
           eligibility check. */
        indexes = @Index(name = "ix_exam_question_exam", columnList = "exam_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long examQuestionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    // Per-assessment point override. NULL falls back to the question's own
    // total_points when scoring, so the same question can be worth different
    // points in different assessments.
    @Column(name = "points", precision = 5, scale = 2)
    private BigDecimal points;
}
