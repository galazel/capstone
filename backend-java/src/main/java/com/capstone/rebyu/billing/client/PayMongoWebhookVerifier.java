package com.capstone.rebyu.billing.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

/**
 * Verifies the {@code Paymongo-Signature} header PayMongo attaches to every
 * webhook delivery, so a forged POST to the webhook URL (which is otherwise
 * a public, unauthenticated endpoint by necessity) can't be treated as a
 * real payment event.
 *
 * <p>Header format: {@code t=<unix_ts>,te=<test_mode_hex_hmac>,li=<live_mode_hex_hmac>}.
 * The signed content is {@code "<unix_ts>.<raw_body>"}, HMAC-SHA256'd with
 * the endpoint's signing secret (from the PayMongo dashboard), hex-encoded.
 * Only one of te/li is populated depending on whether the secret used is a
 * test or live signing secret.
 */
@Slf4j
@Component
public class PayMongoWebhookVerifier {

    @Value("${paymongo.webhook-secret:}")
    private String webhookSecret;

    /** True if a webhook secret is configured at all -- see {@link #verify}. */
    public boolean isConfigured() {
        return webhookSecret != null && !webhookSecret.isBlank();
    }

    /**
     * @return true if the signature is valid, or if no secret is configured
     *     (logged loudly so this can't silently stay unverified forever).
     */
    public boolean verify(String rawBody, String signatureHeader) {
        if (!isConfigured()) {
            log.warn("PAYMONGO WEBHOOK SIGNATURE NOT VERIFIED: paymongo.webhook-secret is not set. "
                    + "Set it from the PayMongo dashboard's webhook signing secret before relying on "
                    + "this endpoint in anything beyond isolated local testing.");
            return true;
        }
        if (signatureHeader == null || signatureHeader.isBlank()) {
            log.warn("Rejected PayMongo webhook: missing Paymongo-Signature header");
            return false;
        }

        Map<String, String> parts = parseSignatureHeader(signatureHeader);
        String timestamp = parts.get("t");
        String candidate = parts.getOrDefault("te", parts.get("li"));
        if (timestamp == null || candidate == null) {
            log.warn("Rejected PayMongo webhook: malformed Paymongo-Signature header");
            return false;
        }

        String expected = hmacSha256Hex(timestamp + "." + rawBody, webhookSecret);
        boolean matches = constantTimeEquals(expected, candidate);
        if (!matches) {
            log.warn("Rejected PayMongo webhook: signature mismatch");
        }
        return matches;
    }

    private Map<String, String> parseSignatureHeader(String header) {
        Map<String, String> parts = new HashMap<>();
        for (String segment : header.split(",")) {
            String[] kv = segment.split("=", 2);
            if (kv.length == 2) {
                parts.put(kv[0].trim(), kv[1].trim());
            }
        }
        return parts;
    }

    private String hmacSha256Hex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            log.error("Failed to compute PayMongo webhook signature", e);
            return "";
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return false;
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
