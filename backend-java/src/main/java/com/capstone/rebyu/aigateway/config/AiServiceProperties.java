package com.capstone.rebyu.aigateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the internal Python AI backend integration. URLs and
 * secrets come from the environment; nothing is hardcoded.
 */
@ConfigurationProperties(prefix = "ai")
public class AiServiceProperties {

    /** Python base URL including the API prefix, e.g. http://localhost:8000/api/v1/ai. */
    private String serviceUrl = "http://localhost:8000/api/v1/ai";

    /** Internal service key sent as X-Service-Key. Empty disables the header. */
    private String apiKey = "";

    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 120000;

    public String getServiceUrl() {
        return serviceUrl;
    }

    public void setServiceUrl(String serviceUrl) {
        this.serviceUrl = serviceUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
