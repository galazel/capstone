package com.capstone.rebyu.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class RabbitMqConfig {

    @Bean
    public Queue curriculumQueue(){
        return QueueBuilder.durable("curriculum.queue").build();
    }

    @Bean
    public Queue certificationQueue(){
        return QueueBuilder.durable("certification.queue").build();
    }
    @Bean
    public Queue checkQueue(){
        return QueueBuilder.durable("queue.queue").build();
    }
    @Bean
    public Queue bktQueue(){
        return QueueBuilder.durable("bkt.queue").build();
    }
    @Bean
    public Queue progressQueue(){
        return QueueBuilder.durable("progress.queue").build();
    }

    @Bean
    public TopicExchange certificationExchange(){
        return new TopicExchange("certification.exchange");
    }

    @Bean
    public TopicExchange assessmentExchange(){
        return new TopicExchange("assessment.exchange");
    }

    @Bean
    public Binding certificationBinding1(){
        return BindingBuilder.bind(curriculumQueue()).to(certificationExchange()).with("certification.created");
    }
    @Bean
    public Binding certificationBinding2(){
        return BindingBuilder.bind(certificationQueue()).to(certificationExchange()).with("curriculum.generated");
    }

    @Bean
    public Binding assesmentBinding1(){
        return BindingBuilder.bind(checkQueue()).to(assessmentExchange()).with("assessment.checked");
    }
    @Bean
    public Binding assesmentBinding2(){
        return BindingBuilder.bind(bktQueue()).to(assessmentExchange()).with("weakness.updated");
    }
    @Bean
    public Binding assesmentBinding3(){
        return BindingBuilder.bind(progressQueue()).to(assessmentExchange()).with("progress.updated");
    }

}
