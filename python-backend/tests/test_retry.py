"""Retry policy tests (Phase 2a step 7).

The old policy retried only `(KeyError, TypeError, ValueError)` -- i.e.
malformed structured output -- so the single most common live failure with
Groq, HTTP 429 rate limiting, was never retried at all. These tests pin the
provider errors as retryable and, just as importantly, pin the deterministic
ones as *not* retryable.
"""

from __future__ import annotations

import httpx
import pytest
from groq import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    RateLimitError,
)

from app.ai.retry import RETRYABLE_ERRORS, is_retryable, llm_retry


def _fast_retry(attempts: int = 3):
    """Near-zero backoff so tests don't actually sleep."""
    return llm_retry(attempts=attempts, initial=0.001, maximum=0.002)


class _Boom(Exception):
    pass


# --- policy membership ----------------------------------------------------

@pytest.mark.parametrize(
    "error",
    [RateLimitError, APITimeoutError, APIConnectionError, InternalServerError],
)
def test_transient_provider_errors_are_retryable(error):
    """These are exactly the ones the previous policy missed."""
    assert issubclass(error, RETRYABLE_ERRORS)


@pytest.mark.parametrize("error", [KeyError, TypeError, ValueError])
def test_malformed_structured_output_is_still_retryable(error):
    assert issubclass(error, RETRYABLE_ERRORS)


@pytest.mark.parametrize("error", [AuthenticationError, BadRequestError])
def test_deterministic_errors_are_not_retryable(error):
    """Retrying a bad API key five times with backoff only delays the
    inevitable failure by about a minute."""
    assert not issubclass(error, RETRYABLE_ERRORS)


# --- tool_use_failed ------------------------------------------------------
#
# Groq schema-checks tool-call arguments server-side and rejects a mismatch
# with a 400. The status code blames the request, but the request was fine --
# the model sampled bad arguments. Retrying resamples; not retrying kills the
# whole curriculum run on one unlucky generation.

def _bad_request(body: object) -> BadRequestError:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(400, request=request)
    return BadRequestError("400", response=response, body=body)


def _tool_use_failed_body() -> dict:
    """The body Groq actually returned when the curriculum agent emitted
    `"certification_focus": "TOPCIT"` instead of a list."""
    return {
        "error": {
            "message": (
                "tool call validation failed: parameters for tool "
                "CertificationCurriculum did not match schema: errors: "
                "[missing properties: 'status', .../certification_focus: "
                "expected array, but got string]"
            ),
            "type": "invalid_request_error",
            "code": "tool_use_failed",
        }
    }


def test_tool_use_failure_is_retryable():
    assert is_retryable(_bad_request(_tool_use_failed_body()))


def test_tool_use_failure_is_retryable_when_body_is_not_json():
    """`body` is the raw response text when the error wasn't valid JSON."""
    assert is_retryable(_bad_request('{"code": "tool_use_failed"'))


@pytest.mark.parametrize(
    "body",
    [
        {"error": {"message": "unknown model", "code": "model_not_found"}},
        {"error": "malformed"},
        None,
    ],
)
def test_other_bad_requests_are_still_not_retryable(body):
    assert not is_retryable(_bad_request(body))


async def test_tool_use_failure_is_resampled():
    attempts = {"n": 0}

    @_fast_retry(attempts=3)
    async def flaky_tool_call():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise _bad_request(_tool_use_failed_body())
        return "ok"

    assert await flaky_tool_call() == "ok"
    assert attempts["n"] == 3


# --- actual retry behaviour -----------------------------------------------

async def test_retries_then_succeeds():
    attempts = {"n": 0}

    @_fast_retry()
    async def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise ValueError("malformed output")
        return "ok"

    assert await flaky() == "ok"
    assert attempts["n"] == 3


async def test_gives_up_after_max_attempts_and_reraises():
    attempts = {"n": 0}

    @_fast_retry(attempts=3)
    async def always_fails():
        attempts["n"] += 1
        raise ValueError("still bad")

    with pytest.raises(ValueError):
        await always_fails()
    assert attempts["n"] == 3


async def test_non_retryable_error_fails_immediately():
    attempts = {"n": 0}

    @_fast_retry()
    async def unauthorised():
        attempts["n"] += 1
        raise _Boom("not in the retryable set")

    with pytest.raises(_Boom):
        await unauthorised()
    assert attempts["n"] == 1, "a non-retryable error must not be retried"


async def _observe_backoff(attempts: int = 5) -> list[float]:
    observed: list[float] = []

    async def _capture_sleep(seconds):
        observed.append(seconds)

    @llm_retry(attempts=attempts, initial=1.0, maximum=60.0, sleep=_capture_sleep)
    async def always_failing():
        raise ValueError("simulated transient failure")

    with pytest.raises(ValueError):
        await always_failing()
    return observed


async def test_backoff_grows_across_attempts():
    """`wait_fixed(2)` slept exactly 2s every time. Backoff must grow, so a
    provider that is still rate-limiting gets progressively more room."""
    observed = await _observe_backoff(attempts=5)

    assert len(observed) == 4, f"expected 4 sleeps before the 5th attempt: {observed}"
    assert observed[-1] > observed[0], f"backoff did not grow: {observed}"
    assert max(observed) <= 60.0, f"backoff exceeded the cap: {observed}"


async def test_backoff_is_jittered_so_parallel_branches_desynchronise():
    """With Send() fan-out, dozens of branches hit the rate limit at once.
    A deterministic policy makes them all retry at the same instant,
    re-triggering the limit; jitter spreads them out."""
    first = await _observe_backoff()
    second = await _observe_backoff()

    assert first != second, (
        f"backoff is deterministic -- parallel branches would retry in "
        f"lockstep: {first} vs {second}"
    )
