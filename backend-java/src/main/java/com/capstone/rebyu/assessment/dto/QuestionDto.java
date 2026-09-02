package com.capstone.rebyu.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
public class QuestionDto {
    private Long questionId;

    // Read-only: always server-set from the caller's JWT on create, ignored on
    // update. Null for questions created before authorship tracking existed.
    private Long createdByUserId;
    private String createdByEmail;
    private LocalDateTime createdAt;

    // NULL = official question. Read-only here -- ownership is set exclusively
    // via the create endpoint's ownerGroupId query param, never from this body.
    private Long ownerGroupId;

    private Long parentQuestionId;

    @NotBlank
    @Size(max = 30)
    private String questionType;

    @NotBlank
    @Size(max = 10)
    private String difficultyLevel;

    @NotBlank
    private String questionText;

    @Size(max = 255)
    private String imageKey;

    @NotNull
    private Long lessonId;

    /**
     * Optional: when present, the server verifies {@code lessonId} belongs to
     * this certification before saving. Not persisted.
     */
    private Long certificationId;

    @Positive
    private BigDecimal totalPoints;

    private List<ChoiceDto> choices;

    /**
     * Which kind of workspace task a CRITICAL_THINKING question actually is:
     * {@code PROGRAMMING}, {@code DIAGRAM}, or null for everything else.
     *
     * <p>Read-only and derived, never stored: {@code question_type} records only
     * that the item is a workspace task, and which one it is lives in the
     * {@code programming_question_configs} / {@code diagram_question_configs}
     * side of the one-to-one. Without this the question bank could not tell the
     * two apart -- its Programming and Diagram filters compared against
     * {@code questionType} and matched nothing, because AI generation writes
     * every one of them as CRITICAL_THINKING. On a TOPCIT bank that is 74
     * programming tasks and 106 diagram tasks that no filter could reach.
     *
     * <p>Ignored on write; the configs are managed through their own endpoints.
     */
    private String criticalThinkingType;
}
