package com.capstone.rebyu.assessment.dto;

/** Lightweight RabbitMQ trigger message published when a learner starts a retake (attemptNumber > 1). */
public record AssessmentRetakeRequestedMessage(Long assessmentAttemptId) {
}
