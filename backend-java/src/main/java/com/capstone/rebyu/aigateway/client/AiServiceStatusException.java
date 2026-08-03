package com.capstone.rebyu.aigateway.client;

import org.springframework.http.HttpStatus;

/**
 * A deliberate, meaningful refusal from the Python AI backend — not a
 * transport failure.
 *
 * <p>{@link AiServiceException} collapses everything into a 500, which is right
 * for "Python is unreachable" and wrong for "that run is already running".
 * Recovery actions in particular answer with 409 and an explanation the admin
 * needs to read; wrapping those hid the reason and left the workspace showing a
 * generic failure while it kept offering a button that could never work.
 */
public class AiServiceStatusException extends RuntimeException {

    private final HttpStatus status;

    public AiServiceStatusException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
