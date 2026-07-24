package com.capstone.rebyu.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "spring.rabbitmq.values")
@Data
public class RabbitMqProperties {
    private List<String> exchanges;
    private List<String> queues;
    private List<String> routes;

}
