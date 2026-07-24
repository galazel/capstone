package com.capstone.rebyu.consumers;

import com.capstone.rebyu.certification.requests.CertificationRequest;
import com.capstone.rebyu.certification.responses.CurriculumGeneratedEvent;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@Slf4j
@AllArgsConstructor
public class CertificationConsumer {
    @Qualifier("pythonClient")
    private final WebClient webClient;

    @RabbitListener(queues = "${spring.rabbitmq.values.queues[1]}")
    public void consumeGeneratedCurriculumAndNotify(
            CurriculumGeneratedEvent curriculumGeneratedEvent) {
        log.info("Certification received: {}", curriculumGeneratedEvent);
        /*
        * after the python generates and sends the status
        * it will send a notification to the frontend that indicates certification with curriculum is now generated
        *
        * */
    }
}
