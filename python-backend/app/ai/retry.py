"""Shared retry policy for LLM calls.

The previous policy, duplicated verbatim in both graph modules, was:

    retry_if_exception_type((KeyError, TypeError, ValueError))
    wait_fixed(2), stop_after_attempt(3)

That retries *malformed structured output* but not a single real provider
failure. The dominant live failure with Groq is HTTP 429 rate limiting,
followed by timeouts and transient 5xx -- none of which are KeyError,
TypeError, or ValueError, so none were ever retried.

`wait_fixed` was also the wrong shape: with `Send()` fan-out, dozens of
branches hit the rate limit simultaneously, all sleep exactly 2s, and all
retry in lockstep -- re-triggering the same limit. Exponential backoff with
jitter de-synchronises them.
"""

from __future__ import annotations

import logging

from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)

# Structured-output failures: the model returned something that didn't
# validate or parse. Worth one more attempt -- the next sample often does.
MALFORMED_OUTPUT_ERRORS: tuple[type[BaseException], ...] = (KeyError, TypeError, ValueError)


def _provider_errors() -> tuple[type[BaseException], ...]:
    """Groq's transient error types, resolved lazily.

    Imported inside the function so this module stays importable if the
    provider SDK is absent or swapped -- retry then simply covers the
    malformed-output cases.
    """
    try:
        from groq import APIConnectionError, APITimeoutError, InternalServerError, RateLimitError
    except Exception:  # pragma: no cover - depends on installed provider SDK
        logger.debug("groq SDK not importable; retrying malformed output only")
        return ()
    return (RateLimitError, APITimeoutError, APIConnectionError, InternalServerError)


# Deliberately NOT retried: AuthenticationError, PermissionDeniedError,
# BadRequestError, NotFoundError. Those are deterministic -- retrying a bad
# API key five times with backoff just delays the inevitable error by ~a
# minute while burning the caller's time.
RETRYABLE_ERRORS: tuple[type[BaseException], ...] = MALFORMED_OUTPUT_ERRORS + _provider_errors()

#: Groq validates tool-call arguments against the response-format schema
#: server-side and rejects a mismatch with HTTP 400. The status code says
#: "your request was wrong", but the *request* was fine -- the model simply
#: sampled malformed arguments (a bare string where a list belongs, a brace
#: closed early). That is the same class of failure as MALFORMED_OUTPUT_ERRORS,
#: which is caught locally, and it usually clears on the next sample.
TOOL_CALL_FAILURE_CODE = "tool_use_failed"


def _is_tool_call_failure(exc: BaseException) -> bool:
    """True for a 400 whose body carries Groq's tool_use_failed code.

    Reads the body defensively: it is `object | None` on the SDK's exception
    and is the raw response text when the error wasn't valid JSON.
    """
    if getattr(exc, "status_code", None) != 400:
        return False
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            return error.get("code") == TOOL_CALL_FAILURE_CODE
    return TOOL_CALL_FAILURE_CODE in str(body or "")


def is_retryable(exc: BaseException) -> bool:
    return isinstance(exc, RETRYABLE_ERRORS) or _is_tool_call_failure(exc)


def _log_retry(state: RetryCallState) -> None:
    exc = state.outcome.exception() if state.outcome else None
    logger.warning(
        "Retrying %s (attempt %d) after %s: %s",
        state.fn.__name__ if state.fn else "<llm call>",
        state.attempt_number,
        type(exc).__name__ if exc else "unknown",
        exc,
    )


def llm_retry(
    attempts: int = 5,
    initial: float = 2.0,
    maximum: float = 60.0,
    sleep=None,
):
    """Retry decorator for any LLM invocation. Works on async functions --
    tenacity detects coroutine functions and wraps them appropriately.

    `sleep` overrides the wait implementation. Tenacity binds its default as
    a function default argument, so it cannot be monkeypatched after import;
    exposing it here lets tests observe the requested backoff delays without
    actually sleeping.
    """
    kwargs = {}
    if sleep is not None:
        kwargs["sleep"] = sleep
    return retry(
        reraise=True,
        stop=stop_after_attempt(attempts),
        wait=wait_exponential_jitter(initial=initial, max=maximum),
        retry=retry_if_exception(is_retryable),
        before_sleep=_log_retry,
        **kwargs,
    )


# Default policy used by the graph nodes.
retry_llm_call = llm_retry()
