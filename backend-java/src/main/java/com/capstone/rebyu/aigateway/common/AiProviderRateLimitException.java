package com.capstone.rebyu.aigateway.common;

public class AiProviderRateLimitException extends RuntimeException {

    public AiProviderRateLimitException(String message) {
        super(message);
    }

    public AiProviderRateLimitException(String message, Throwable cause) {
        super(message, cause);
    }
}
