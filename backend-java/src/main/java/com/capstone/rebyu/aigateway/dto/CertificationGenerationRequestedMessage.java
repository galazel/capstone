package com.capstone.rebyu.aigateway.dto;

/** Lightweight RabbitMQ trigger message: ids only, no generated content. */
public record CertificationGenerationRequestedMessage(Long generationRequestId, Long certificationId) {
}
