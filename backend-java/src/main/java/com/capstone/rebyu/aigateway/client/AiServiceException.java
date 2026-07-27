package com.capstone.rebyu.aigateway.client;

/** Raised when the Python AI backend call fails or returns an unusable response. */
public class AiServiceException extends RuntimeException {
    public AiServiceException(String message) {
        super(message);
    }

    public AiServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
