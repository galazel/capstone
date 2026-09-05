package com.capstone.rebyu.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.dao.DataAccessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

public class RedisResponseCacheFilter extends OncePerRequestFilter {

    private static final Logger log =
            LoggerFactory.getLogger(RedisResponseCacheFilter.class);
    private static final String VERSION_KEY = "rebyu:response-cache:version";
    private static final String CACHE_PREFIX = "rebyu:response-cache:";

    private final StringRedisTemplate redis;
    private final boolean enabled;
    private final Duration ttl;

    public RedisResponseCacheFilter(
            StringRedisTemplate redis,
            boolean enabled,
            Duration ttl
    ) {
        this.redis = redis;
        this.enabled = enabled;
        this.ttl = ttl;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!enabled || shouldSkip(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            if (isWrite(request)) {
                invalidate();
            }
            return;
        }

        String cacheKey;
        String cachedResponse;
        try {
            cacheKey = cacheKey(request);
            cachedResponse = redis.opsForValue().get(cacheKey);
        } catch (DataAccessException exception) {
            log.warn("Redis response cache unavailable; serving {} directly", request.getRequestURI());
            filterChain.doFilter(request, response);
            return;
        }
        if (cachedResponse != null) {
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(cachedResponse);
            return;
        }

        ContentCachingResponseWrapper wrappedResponse =
                new ContentCachingResponseWrapper(response);
        filterChain.doFilter(request, wrappedResponse);

        byte[] body = wrappedResponse.getContentAsByteArray();
        if (wrappedResponse.getStatus() == HttpServletResponse.SC_OK
                && isJson(wrappedResponse)
                && body.length > 0) {
            try {
                redis.opsForValue().set(
                        cacheKey,
                        new String(body, StandardCharsets.UTF_8),
                        ttl
                );
            } catch (DataAccessException exception) {
                log.warn("Could not store response cache entry for {}", request.getRequestURI());
            }
        }
        wrappedResponse.copyBodyToResponse();
    }

    private boolean shouldSkip(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/actuator/")
                || uri.contains("/stream")
                || uri.contains("/events")
                || uri.endsWith("/sse");
    }

    private boolean isWrite(HttpServletRequest request) {
        String method = request.getMethod();
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
    }

    private boolean isJson(ContentCachingResponseWrapper response) {
        String contentType = response.getContentType();
        return contentType != null
                && (contentType.startsWith("application/json")
                || contentType.startsWith("application/problem+json"));
    }

    private String cacheKey(HttpServletRequest request) {
        String version = redis.opsForValue().get(VERSION_KEY);
        if (version == null) {
            version = "0";
        }
        String authorization = request.getHeader("Authorization");
        String identity = authorization == null ? "anonymous" : sha256(authorization);
        String requestTarget = request.getRequestURI()
                + (request.getQueryString() == null ? "" : "?" + request.getQueryString());
        return CACHE_PREFIX + version + ":" + identity + ":" + sha256(requestTarget);
    }

    private void invalidate() {
        try {
            redis.opsForValue().increment(VERSION_KEY);
        } catch (DataAccessException exception) {
            log.warn("Could not invalidate Redis response cache after a write");
        }
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
