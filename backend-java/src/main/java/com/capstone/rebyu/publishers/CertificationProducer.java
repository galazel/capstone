package com.capstone.rebyu.publishers;

import com.capstone.rebyu.certification.requests.CertificationRequest;
import com.capstone.rebyu.properties.RabbitMqProperties;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@AllArgsConstructor
@Slf4j
public class CertificationProducer {
    private final RabbitMqProperties rabbitMqProperties;
    private final RabbitTemplate rabbitTemplate;


   public void sendCertificationForGeneratingCurriculum(CertificationRequest certificationRequest){
      log.info("Certification request sent ->", certificationRequest);
      rabbitTemplate.convertAndSend(rabbitMqProperties.getExchanges().get(0), rabbitMqProperties.getRoutes().get(0), certificationRequest);
   }
}
