package com.capstone.rebyu.aigateway.dto;

/** Lightweight RabbitMQ trigger message: ids only, no generated content. */
public record QuestionGenerationRequestedMessage(Long generationRequestId, Long certificationId) {
}
