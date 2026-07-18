package com.capstone.rebyu.billing.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PayMongoClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${paymongo.api-key:}")
    private String apiKey;

    @Value("${paymongo.enabled:false}")
    private boolean enabled;

    @Value("${paymongo.base-url:https://api.paymongo.com/v1}")
    private String baseUrl;

    public boolean isEnabled() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    /**
     * Create a PayMongo Link for subscription (checkout).
     * Returns the checkout URL.
     */
    public String createCheckoutLink(Long learnerId, Long planId, String planCode, long amountCents) {
        if (!isEnabled()) {
            log.warn("PayMongo is disabled; cannot create checkout link");
            return null;
        }
        try {
            Map<String, Object> body = new HashMap<>();
            Map<String, Object> data = new HashMap<>();
            data.put("attributes", Map.of(
                    "amount", amountCents,
                    "currency", "PHP",
                    "description", "REBYU Plan: " + planCode,
                    "line_items", new Object[]{Map.of(
                            "currency", "PHP",
                            "amount", amountCents,
                            "description", planCode,
                            "quantity", 1
                    )},
                    "metadata", Map.of("learnerId", learnerId, "planId", planId)
            ));
            body.put("data", data);

            String response = postRequest("/checkout_sessions", body);
            JsonNode root = objectMapper.readTree(response);
            return root.path("data").path("attributes").path("checkout_url").asText();
        } catch (Exception e) {
            log.error("Failed to create PayMongo checkout link: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Retrieve a checkout session from PayMongo.
     */
    public Map<String, Object> getCheckoutSession(String sessionId) {
        if (!isEnabled()) return null;
        try {
            String response = getRequest("/checkout_sessions/" + sessionId);
            return objectMapper.readValue(response, Map.class);
        } catch (Exception e) {
            log.error("Failed to get PayMongo checkout session: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Retrieve a subscription from PayMongo.
     */
    public Map<String, Object> getSubscription(String subscriptionId) {
        if (!isEnabled()) return null;
        try {
            String response = getRequest("/subscriptions/" + subscriptionId);
            return objectMapper.readValue(response, Map.class);
        } catch (Exception e) {
            log.error("Failed to get PayMongo subscription: {}", e.getMessage());
            return null;
        }
    }

    private String postRequest(String path, Object body) {
        String url = baseUrl + path;
        String auth = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":").getBytes());
        return restTemplate.postForObject(url, body, String.class);
    }

    private String getRequest(String path) {
        String url = baseUrl + path;
        String auth = "Basic " + Base64.getEncoder().encodeToString((apiKey + ":").getBytes());
        return restTemplate.getForObject(url, String.class);
    }
}
