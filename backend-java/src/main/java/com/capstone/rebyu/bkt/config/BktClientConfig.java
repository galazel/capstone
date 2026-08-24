package com.capstone.rebyu.bkt.config;

import io.netty.channel.ChannelOption;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Wires the internal WebClient used to reach the FastAPI BKT service and turns
 * on scheduling for the outbox dispatcher.
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(BktProperties.class)
public class BktClientConfig {

    @Bean("bktWebClient")
    public WebClient bktWebClient(BktProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.getConnectTimeoutMs())
                .responseTimeout(Duration.ofMillis(properties.getReadTimeoutMs()));

        WebClient.Builder builder = WebClient.builder()
                .baseUrl(properties.getServiceUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json");

        if (properties.getApiKey() != null && !properties.getApiKey().isBlank()) {
            builder.defaultHeader("X-Service-Key", properties.getApiKey());
        }
        return builder.build();
    }

    /**
     * Fan-out pool for the analytics board's BKT reads.
     *
     * <p>The progress-analytics endpoint needs four independent answers from
     * this service. Asked one after another they cost the sum of four round
     * trips; asked together they cost the slowest one. The calls are pure HTTP
     * with no database or transaction involvement, so running them off the
     * request thread is safe.
     *
     * <p>Deliberately bounded, and deliberately CALLER_RUNS. Each task holds a
     * thread for as long as the BKT read takes (up to
     * {@code bkt.read-timeout-ms}), so an unbounded pool under load would be a
     * thread per in-flight analytics request times four. When the pool and its
     * queue are full the submitting request thread runs the task itself: the
     * fan-out degrades back to the sequential behaviour it replaced instead of
     * throwing, which is the right failure mode for a read that already
     * tolerates the service being down entirely.
     */
    @Bean("bktAnalyticsExecutor")
    public Executor bktAnalyticsExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(64);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("bkt-analytics-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
