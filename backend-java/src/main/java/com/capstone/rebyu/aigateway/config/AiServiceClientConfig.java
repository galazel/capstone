package com.capstone.rebyu.aigateway.config;

import io.netty.channel.ChannelOption;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

/**
 * Wires the internal WebClient used to reach the Python AI backend. Mirrors
 * {@code com.capstone.rebyu.bkt.config.BktClientConfig}.
 */
@Configuration
@EnableConfigurationProperties(AiServiceProperties.class)
public class AiServiceClientConfig {

    /** 16 MB. Generous, but bounded — an unbounded limit turns a runaway
     *  response into heap pressure instead of an error. */
    private static final int MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

    @Bean("aiWebClient")
    public WebClient aiWebClient(AiServiceProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.getConnectTimeoutMs())
                .responseTimeout(Duration.ofMillis(properties.getReadTimeoutMs()));

        WebClient.Builder builder = WebClient.builder()
                .baseUrl(properties.getServiceUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                // Codec buffers are per *message*, and one message here can be
                // a whole generated curriculum, a lesson, or a timeline replay
                // frame. The 256 KB default silently turned a large-enough
                // response into a DataBufferLimitException — which surfaced as
                // a workflow timeline that reconnected forever and showed
                // nothing, rather than as an obvious failure.
                .codecs(codecs -> codecs.defaultCodecs()
                        .maxInMemorySize(MAX_RESPONSE_BYTES));

        if (properties.getApiKey() != null && !properties.getApiKey().isBlank()) {
            builder.defaultHeader("X-Service-Key", properties.getApiKey());
        }
        return builder.build();
    }
}
