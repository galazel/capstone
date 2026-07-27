package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.dto.CertificationGenerationRequestedMessage;
import com.capstone.rebyu.aigateway.dto.QuestionGenerationRequestedMessage;
import com.capstone.rebyu.config.RabbitMqConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * Publishes lightweight, ids-only trigger messages for AI generation
 * requests. Never blocks or fails the admin-facing request that triggers
 * it -- a broker hiccup here must not break the (still-synchronous, for
 * now) generation flow it rides alongside.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationRequestProducer {

    private final RabbitTemplate rabbitTemplate;

    public void publishCertificationGenerationRequested(Long generationRequestId, Long certificationId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE,
                    RabbitMqConfig.CERTIFICATION_GENERATION_ROUTING_KEY,
                    new CertificationGenerationRequestedMessage(generationRequestId, certificationId));
        } catch (Exception e) {
            log.warn("Could not publish certification generation trigger for request {}: {}",
                    generationRequestId, e.getMessage());
        }
    }

    public void publishQuestionGenerationRequested(Long generationRequestId, Long certificationId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE,
                    RabbitMqConfig.QUESTION_GENERATION_ROUTING_KEY,
                    new QuestionGenerationRequestedMessage(generationRequestId, certificationId));
        } catch (Exception e) {
            log.warn("Could not publish question generation trigger for request {}: {}",
                    generationRequestId, e.getMessage());
        }
    }
}
