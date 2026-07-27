package com.capstone.rebyu.consumers;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@Slf4j
public class AssessmentConsumer {
    private final WebClient webClient;

    public AssessmentConsumer(@Qualifier("pythonClient") WebClient webClient) {
        this.webClient = webClient;
    }

    @RabbitListener(queues = "${spring.rabbitmq.values.queues[0]}")
    public void consumeAssessmentAfterCheckedByAI() {
        /*
         * after
         */
    }
}
