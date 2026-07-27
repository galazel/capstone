package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.dto.AssessmentRetakeRequestedMessage;
import com.capstone.rebyu.assessment.dto.AssessmentSubmittedMessage;
import com.capstone.rebyu.config.RabbitMqConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

/**
 * Publishes lightweight, ids-only trigger messages for assessment
 * submission and retake events. Never blocks or fails the learner-facing
 * request that triggers it -- a broker hiccup here must not break
 * submitting or retaking an assessment.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentEventProducer {

    private final RabbitTemplate rabbitTemplate;

    public void publishAssessmentSubmitted(Long assessmentAttemptId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE,
                    RabbitMqConfig.ASSESSMENT_SUBMITTED_ROUTING_KEY,
                    new AssessmentSubmittedMessage(assessmentAttemptId));
        } catch (Exception e) {
            log.warn("Could not publish assessment submitted trigger for attempt {}: {}",
                    assessmentAttemptId, e.getMessage());
        }
    }

    public void publishAssessmentRetakeRequested(Long assessmentAttemptId) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMqConfig.EXCHANGE,
                    RabbitMqConfig.ASSESSMENT_RETAKE_ROUTING_KEY,
                    new AssessmentRetakeRequestedMessage(assessmentAttemptId));
        } catch (Exception e) {
            log.warn("Could not publish assessment retake trigger for attempt {}: {}",
                    assessmentAttemptId, e.getMessage());
        }
    }
}
