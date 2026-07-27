package com.capstone.rebyu.assessment.dto;

/** Lightweight RabbitMQ trigger message published when an assessment attempt is submitted. */
public record AssessmentSubmittedMessage(Long assessmentAttemptId) {
}
