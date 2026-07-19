package com.capstone.rebyu.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Shared blocking HTTP client for outbound calls to third-party REST APIs
 * (currently PayMongo). Nothing in the app previously defined this bean, so
 * any consumer requiring a plain {@link RestTemplate} (PayMongoClient) failed
 * to start.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
