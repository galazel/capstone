package com.capstone.rebyu.publishers;

import com.capstone.rebyu.properties.RabbitMqProperties;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@AllArgsConstructor
public class AssessmentProducer {
    private final RabbitMqProperties rabbitMqProperties;
    private final RabbitTemplate rabbitTemplate;
}
