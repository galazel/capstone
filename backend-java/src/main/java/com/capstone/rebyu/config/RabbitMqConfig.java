package com.capstone.rebyu.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ topology for the lightweight, ids-only trigger messages Spring
 * Boot publishes (never the full generated payload -- that's re-fetched by
 * id on the consumer side). Every queue has a matching dead-letter queue so
 * a message that repeatedly fails processing is never silently lost.
 *
 * <p>These queues are producers-only for now: Phase 5 wires the publish
 * side; a later phase adds the Python-side (or Java-side) consumers. Until
 * then messages simply accumulate on the main queues, which is expected.
 */
@Configuration
public class RabbitMqConfig {

    public static final String EXCHANGE = "rebyu.exchange";
    private static final String DEAD_LETTER_EXCHANGE = "rebyu.dlx";

    public static final String CERTIFICATION_GENERATION_QUEUE = "certification.generation.queue";
    public static final String CERTIFICATION_GENERATION_ROUTING_KEY = "certification.generation.requested";

    public static final String QUESTION_GENERATION_QUEUE = "question.generation.queue";
    public static final String QUESTION_GENERATION_ROUTING_KEY = "question.generation.requested";

    public static final String ASSESSMENT_SUBMITTED_QUEUE = "assessment.submitted.queue";
    public static final String ASSESSMENT_SUBMITTED_ROUTING_KEY = "assessment.submitted";

    public static final String ASSESSMENT_RETAKE_QUEUE = "assessment.retake.queue";
    public static final String ASSESSMENT_RETAKE_ROUTING_KEY = "assessment.retake.requested";

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.findAndRegisterModules();
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public TopicExchange rebyuExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public TopicExchange rebyuDeadLetterExchange() {
        return new TopicExchange(DEAD_LETTER_EXCHANGE);
    }

    // --- Certification generation ---------------------------------------

    @Bean
    public Queue certificationGenerationQueue() {
        return dlqBackedQueue(CERTIFICATION_GENERATION_QUEUE);
    }

    @Bean
    public Queue certificationGenerationDeadLetterQueue() {
        return QueueBuilder.durable(deadLetterQueueName(CERTIFICATION_GENERATION_QUEUE)).build();
    }

    @Bean
    public Binding certificationGenerationBinding() {
        return BindingBuilder.bind(certificationGenerationQueue())
                .to(rebyuExchange()).with(CERTIFICATION_GENERATION_ROUTING_KEY);
    }

    @Bean
    public Binding certificationGenerationDeadLetterBinding() {
        return BindingBuilder.bind(certificationGenerationDeadLetterQueue())
                .to(rebyuDeadLetterExchange()).with(deadLetterRoutingKey(CERTIFICATION_GENERATION_QUEUE));
    }

    // --- Question generation ----------------------------------------------

    @Bean
    public Queue questionGenerationQueue() {
        return dlqBackedQueue(QUESTION_GENERATION_QUEUE);
    }

    @Bean
    public Queue questionGenerationDeadLetterQueue() {
        return QueueBuilder.durable(deadLetterQueueName(QUESTION_GENERATION_QUEUE)).build();
    }

    @Bean
    public Binding questionGenerationBinding() {
        return BindingBuilder.bind(questionGenerationQueue())
                .to(rebyuExchange()).with(QUESTION_GENERATION_ROUTING_KEY);
    }

    @Bean
    public Binding questionGenerationDeadLetterBinding() {
        return BindingBuilder.bind(questionGenerationDeadLetterQueue())
                .to(rebyuDeadLetterExchange()).with(deadLetterRoutingKey(QUESTION_GENERATION_QUEUE));
    }

    // --- Assessment submitted ----------------------------------------------

    @Bean
    public Queue assessmentSubmittedQueue() {
        return dlqBackedQueue(ASSESSMENT_SUBMITTED_QUEUE);
    }

    @Bean
    public Queue assessmentSubmittedDeadLetterQueue() {
        return QueueBuilder.durable(deadLetterQueueName(ASSESSMENT_SUBMITTED_QUEUE)).build();
    }

    @Bean
    public Binding assessmentSubmittedBinding() {
        return BindingBuilder.bind(assessmentSubmittedQueue())
                .to(rebyuExchange()).with(ASSESSMENT_SUBMITTED_ROUTING_KEY);
    }

    @Bean
    public Binding assessmentSubmittedDeadLetterBinding() {
        return BindingBuilder.bind(assessmentSubmittedDeadLetterQueue())
                .to(rebyuDeadLetterExchange()).with(deadLetterRoutingKey(ASSESSMENT_SUBMITTED_QUEUE));
    }

    // --- Assessment retake ---------------------------------------------

    @Bean
    public Queue assessmentRetakeQueue() {
        return dlqBackedQueue(ASSESSMENT_RETAKE_QUEUE);
    }

    @Bean
    public Queue assessmentRetakeDeadLetterQueue() {
        return QueueBuilder.durable(deadLetterQueueName(ASSESSMENT_RETAKE_QUEUE)).build();
    }

    @Bean
    public Binding assessmentRetakeBinding() {
        return BindingBuilder.bind(assessmentRetakeQueue())
                .to(rebyuExchange()).with(ASSESSMENT_RETAKE_ROUTING_KEY);
    }

    @Bean
    public Binding assessmentRetakeDeadLetterBinding() {
        return BindingBuilder.bind(assessmentRetakeDeadLetterQueue())
                .to(rebyuDeadLetterExchange()).with(deadLetterRoutingKey(ASSESSMENT_RETAKE_QUEUE));
    }

    // ------------------------------------------------------------------

    private static Queue dlqBackedQueue(String name) {
        return QueueBuilder.durable(name)
                .withArgument("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", deadLetterRoutingKey(name))
                .build();
    }

    private static String deadLetterQueueName(String queueName) {
        return queueName.replace(".queue", ".dlq");
    }

    private static String deadLetterRoutingKey(String queueName) {
        return deadLetterQueueName(queueName);
    }
}
