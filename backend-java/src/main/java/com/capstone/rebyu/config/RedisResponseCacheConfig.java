package com.capstone.rebyu.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisResponseCacheConfig {

    @Bean
    public StringRedisTemplate redisResponseCacheTemplate(
            RedisConnectionFactory connectionFactory
    ) {
        StringRedisTemplate template = new StringRedisTemplate(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        return template;
    }

    @Bean
    public RedisResponseCacheFilter redisResponseCacheFilter(
            StringRedisTemplate redisResponseCacheTemplate,
            @Value("${app.response-cache.enabled:true}") boolean enabled,
            @Value("${app.response-cache.ttl-seconds:30}") long ttlSeconds,
            @Value("${app.response-cache.failure-cooldown-seconds:30}") long failureCooldownSeconds
    ) {
        if (ttlSeconds <= 0) {
            throw new IllegalArgumentException("app.response-cache.ttl-seconds must be greater than zero");
        }
        if (failureCooldownSeconds <= 0) {
            throw new IllegalArgumentException(
                    "app.response-cache.failure-cooldown-seconds must be greater than zero");
        }
        return new RedisResponseCacheFilter(
                redisResponseCacheTemplate,
                enabled,
                Duration.ofSeconds(ttlSeconds),
                Duration.ofSeconds(failureCooldownSeconds)
        );
    }
}
