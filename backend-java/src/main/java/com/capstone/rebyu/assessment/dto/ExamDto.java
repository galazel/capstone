package com.capstone.rebyu.assessment.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExamDto {
    private Long examId;

    @NotNull
    private Long certificationId;

    @NotNull
    private Long examTypeId;

    @NotBlank
    @Size(max = 150)
    private String title;

    private boolean isGenerated = false;

    @Min(1)
    private Integer durationMinutes;

    @NotNull
    @Min(1)
    private Integer totalQuestions;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private BigDecimal passingScore;

    private String status;

    private String description;

    private String instructions;

    private Long lessonId;

    private Long middleCategoryId;

    private Long majorCategoryId;

    private String targetScope;

    private LocalDateTime publishedAt;

    private LocalDateTime updatedAt;

    /** Whether correct answers/explanations are shown to learners after submitting. Null = true. */
    private Boolean releaseAnswersAfterSubmit;

    // NULL = official exam. Read-only here -- ownership is set exclusively
    // via the create endpoint's ownerGroupId query param, never accepted
    // directly from this DTO's create/update body. See MajorCategoryDto.
    private Long ownerGroupId;

    /**
     * Ordered list of the questions the admin selected, with the per-question
     * point value and display order. This is the single source of truth for
     * what the assessment contains; when present it fully replaces the exam's
     * question set (points and order included) on create/update.
     */
    private List<ExamQuestionInput> questions;

    /**
     * Legacy/compatibility list of selected question ids without points.
     * Retained for callers that only need to set the question set; prefer
     * {@link #questions} when per-question points must be persisted. On read,
     * the service always populates this with the ordered selected ids.
     */
    private List<Long> questionIds;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamQuestionInput {
        @NotNull
        private Long questionId;

        /** Optional per-assessment points; null falls back to the question default. */
        @DecimalMin("0.0")
        private BigDecimal points;

        /** 1-based position; when null the service assigns list order. */
        private Integer displayOrder;
    }
}
