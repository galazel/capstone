package com.capstone.rebyu.assessment.dto;

import java.time.LocalDateTime;

public record AssessmentAttemptDto(
    Long attemptId,
    Long assessmentId,
    String status,
    LocalDateTime startedAt,
    LocalDateTime submittedAt
) {}
