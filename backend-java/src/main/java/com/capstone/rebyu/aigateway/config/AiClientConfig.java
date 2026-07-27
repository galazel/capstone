package com.capstone.rebyu.aigateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class AiClientConfig {

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Primary
    @Bean(name = {"aiWebClient", "pythonClient"})
    public WebClient aiWebClient() {
        return WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();
    }
}
