"""Shared retry policy for LLM calls.

The previous policy, duplicated verbatim in both graph modules, was:

    retry_if_exception_type((KeyError, TypeError, ValueError))
    wait_fixed(2), stop_after_attempt(3)

That retries *malformed structured output* but not a single real provider
failure. The dominant live failure is HTTP 429 rate limiting, followed by
timeouts and transient 5xx -- none of which are KeyError, TypeError, or
ValueError, so none were ever retried.

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

from app.ai.quota import (
    is_account_daily_cap,
    is_daily_quota_exhausted,
    is_out_of_credits,
    is_request_too_large,
    is_upstream_unavailable,
)

logger = logging.getLogger(__name__)

# Structured-output failures: the model returned something that didn't
# validate or parse. Worth one more attempt -- the next sample often does.
MALFORMED_OUTPUT_ERRORS: tuple[type[BaseException], ...] = (KeyError, TypeError, ValueError)


def _provider_errors() -> tuple[type[BaseException], ...]:
    """The client SDK's transient error types, resolved lazily.

    `openai`, because every model is reached through OpenRouter's
    OpenAI-compatible endpoint -- so these are the exception types raised for a
    Claude call and a Gemini call alike, which is precisely what lets one retry
    policy cover the whole per-task model table.

    Imported inside the function so this module stays importable if the SDK is
    absent -- retry then simply covers the malformed-output cases.
    """
    try:
        from openai import (
            APIConnectionError,
            APITimeoutError,
            InternalServerError,
            RateLimitError,
        )
    except Exception:  # pragma: no cover - depends on installed provider SDK
        logger.debug("openai SDK not importable; retrying malformed output only")
        return ()
    return (RateLimitError, APITimeoutError, APIConnectionError, InternalServerError)


# Deliberately NOT retried: AuthenticationError, PermissionDeniedError,
# BadRequestError, NotFoundError. Those are deterministic -- retrying a bad
# API key five times with backoff just delays the inevitable error by ~a
# minute while burning the caller's time.
RETRYABLE_ERRORS: tuple[type[BaseException], ...] = MALFORMED_OUTPUT_ERRORS + _provider_errors()

#: Some providers validate tool-call arguments against the response-format
#: schema server-side and reject a mismatch with HTTP 400. The status code says
#: "your request was wrong", but the *request* was fine -- the model simply
#: sampled malformed arguments (a bare string where a list belongs, a brace
#: closed early). That is the same class of failure as MALFORMED_OUTPUT_ERRORS,
#: which is caught locally, and it usually clears on the next sample.
#:
#: Kept after the move to OpenRouter rather than deleted: OpenRouter forwards
#: the upstream body verbatim, so a Groq-served model still reports exactly
#: this, and the per-task table can route a task to one at any time.
TOOL_CALL_FAILURE_CODE = "tool_use_failed"

#: The same failure as above under other vendors' spellings. OpenRouter does
#: not normalise error codes, so matching only one vendor's would quietly stop
#: resampling the moment a task's model changed -- turning a recoverable bad
#: sample back into a failed generation run.
_TOOL_CALL_FAILURE_MARKERS = (
    TOOL_CALL_FAILURE_CODE,
    "invalid_function_parameters",
    "invalid tool call",
    "failed to parse tool call",
    "invalid_tool_use",
)


def _is_tool_call_failure(exc: BaseException) -> bool:
    """True for a 400 whose body says the model's tool call was malformed.

    Reads the body defensively: it is `object | None` on the SDK's exception
    and is the raw response text when the error wasn't valid JSON.
    """
    if getattr(exc, "status_code", None) != 400:
        return False
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            if error.get("code") in _TOOL_CALL_FAILURE_MARKERS:
                return True
            body = error.get("message") or body
    text = str(body or "").lower()
    return any(marker in text for marker in _TOOL_CALL_FAILURE_MARKERS)


def is_retryable(exc: BaseException) -> bool:
    # A spent *daily* budget is a 429, so it matches RateLimitError below, but
    # it does not clear within any backoff this policy can express -- the live
    # error asks for 1h34m against a 60s ceiling. `app.ai.router` handles it by
    # switching models, which only works if the exception reaches it promptly,
    # so it must not be absorbed here. Per-minute 429s stay retryable.
    if is_daily_quota_exhausted(exc):
        return False
    # The free tier's account-wide daily cap resets in hours, not seconds. It is
    # a RateLimitError, so without this it would consume the full retry budget
    # before the router got to report the reset time.
    if is_account_daily_cap(exc):
        return False
    # A request bigger than the model's whole per-minute allowance cannot
    # succeed on a later attempt either -- next minute's budget is full and
    # still too small. Excluded explicitly rather than relying on the provider
    # SDK mapping 413 to a type that happens not to be listed below.
    if is_request_too_large(exc):
        return False
    # No credit is an account-level wall: five backed-off attempts cannot buy
    # any. It arrives as a 402, which the SDK maps to nothing listed below, but
    # it can also arrive as a RateLimitError -- which *is* listed -- so it has
    # to be excluded explicitly or it would burn the full retry budget.
    if is_out_of_credits(exc):
        return False
    # An upstream vendor outage outlasts this policy's 60s ceiling, and
    # `app.ai.router` routes around it by picking a model from a different
    # vendor. That only works if the exception reaches the router promptly, so
    # it must not be absorbed here -- the same reasoning as daily exhaustion.
    if is_upstream_unavailable(exc):
        return False
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
