"""Quota classification and model-fallback tests.

The live failure these cover:

    Rate limit reached for model `llama-3.3-70b-versatile` ... on tokens per
    day (TPD): Limit 100000, Used 96604, Requested 9985.
    Please try again in 1h34m52.896s

The retry policy treated that as a transient 429 and backed off, but its
ceiling is 60s over 5 attempts against a limit that needs 95 minutes -- so
every attempt was guaranteed to fail and the generation run was lost. These
tests pin the two halves of the fix: recognising a *daily* limit as distinct
from a per-minute one, and switching models rather than sleeping.
"""

from __future__ import annotations

import pytest

from app.ai import quota
from app.ai.retry import is_retryable
from app.ai.router import (
    AllModelsExhausted,
    RequestTooLarge,
    ainvoke_with_fallback,
    model_chain,
)
from app.core.config import get_settings

PRIMARY = "llama-3.3-70b-versatile"
FALLBACK = "llama-3.1-8b-instant"

DAILY_MESSAGE = (
    f"Rate limit reached for model `{PRIMARY}` in organization `org_01kv07` "
    "service tier `on_demand` on tokens per day (TPD): Limit 100000, "
    "Used 96604, Requested 9985. Please try again in 1h34m52.896s. "
    "Need more tokens? Upgrade to Dev Tier today"
)

BURST_MESSAGE = (
    f"Rate limit reached for model `{PRIMARY}` on tokens per minute (TPM): "
    "Limit 12000, Used 11500, Requested 900. Please try again in 4.5s"
)


class _FakeRateLimit(Exception):
    """Stands in for groq.RateLimitError -- the classifier reads only
    `status_code` and the message body, so it needs nothing else."""

    def __init__(self, message: str, status: int = 429):
        super().__init__(message)
        self.status_code = status
        self.body = {"error": {"message": message, "code": "rate_limit_exceeded"}}


@pytest.fixture(autouse=True)
def _clear_quota_state():
    """Exhaustion state is process-global, so it must not leak between tests."""
    quota.reset()
    yield
    quota.reset()


# --- classification -------------------------------------------------------

def test_daily_limit_is_recognised():
    assert quota.is_daily_quota_exhausted(_FakeRateLimit(DAILY_MESSAGE))


def test_per_minute_limit_is_not_treated_as_daily():
    """The distinction that matters: a TPM limit clears in seconds, so backoff
    remains the right remedy for it."""
    assert not quota.is_daily_quota_exhausted(_FakeRateLimit(BURST_MESSAGE))


def _real_rate_limit(message: str):
    """A genuine groq.RateLimitError.

    The retry predicate checks `isinstance` against the provider's exception
    classes, so the fake above can never be retryable regardless of the new
    guard -- pinning the guard's *effect* on the policy needs the real type.
    """
    httpx = pytest.importorskip("httpx")
    groq = pytest.importorskip("groq")
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return groq.RateLimitError(
        "429",
        response=response,
        body={"error": {"message": message, "code": "rate_limit_exceeded"}},
    )


def test_daily_limit_is_excluded_from_retry():
    """Otherwise tenacity absorbs it for five attempts and the router never
    gets the chance to switch models."""
    assert not is_retryable(_real_rate_limit(DAILY_MESSAGE))


def test_per_minute_limit_stays_retryable():
    """The guard must be narrow: it may not strip ordinary burst 429s out of
    the retry policy, which is the one thing backoff genuinely fixes."""
    assert is_retryable(_real_rate_limit(BURST_MESSAGE))


def test_non_rate_limit_errors_are_unaffected():
    assert not quota.is_daily_quota_exhausted(ValueError("malformed output"))
    assert not quota.is_daily_quota_exhausted(_FakeRateLimit("bad request", status=400))


# --- reset-time parsing ---------------------------------------------------

def test_parses_composite_duration_from_message():
    seconds = quota.parse_retry_after(_FakeRateLimit(DAILY_MESSAGE))
    assert seconds == pytest.approx(1 * 3600 + 34 * 60 + 52.896)


def test_parses_bare_seconds():
    assert quota.parse_retry_after(_FakeRateLimit(BURST_MESSAGE)) == pytest.approx(4.5)


def test_returns_none_when_no_duration_present():
    """None, not 0 -- a zero cooldown would let the caller hot-loop against a
    limit that has not cleared."""
    assert quota.parse_retry_after(_FakeRateLimit("Rate limit reached")) is None


# --- exhaustion registry --------------------------------------------------

def test_model_is_skipped_until_its_cooldown_expires():
    assert not quota.is_exhausted(PRIMARY)
    quota.mark_exhausted(PRIMARY, 600)
    assert quota.is_exhausted(PRIMARY)
    assert quota.seconds_until_available(PRIMARY) == pytest.approx(600, abs=1)


def test_cooldown_expires():
    quota.mark_exhausted(PRIMARY, -1)
    assert not quota.is_exhausted(PRIMARY)


def test_a_shorter_limit_cannot_shorten_an_existing_cooldown():
    quota.mark_exhausted(PRIMARY, 3600)
    quota.mark_exhausted(PRIMARY, 5)
    assert quota.seconds_until_available(PRIMARY) == pytest.approx(3600, abs=1)


# --- model chain ----------------------------------------------------------

def test_chain_puts_primary_first_and_deduplicates():
    """The shipped config has ai_default_model equal to ai_generation_model, so
    without de-duplication the chain would retry the exhausted model twice."""
    chain = model_chain("generation")
    assert chain[0] == get_settings().ai_generation_model
    assert len(chain) == len(set(chain))


# --- fallback behaviour ---------------------------------------------------

class _Agent:
    """Fails with `error` if given one, else records the call and succeeds."""

    def __init__(self, model: str, error: Exception | None, calls: list[str]):
        self.model = model
        self.error = error
        self.calls = calls

    async def ainvoke(self, payload, config=None):
        self.calls.append(self.model)
        if self.error is not None:
            raise self.error
        return {"structured_response": f"ok from {self.model}"}


def _factory(errors: dict[str, Exception], calls: list[str]):
    return lambda model: _Agent(model, errors.get(model), calls)


async def test_falls_back_to_the_next_model_when_the_daily_budget_is_spent():
    calls: list[str] = []
    result = await ainvoke_with_fallback(
        _factory({PRIMARY: _FakeRateLimit(DAILY_MESSAGE)}, calls),
        {"messages": []},
    )
    assert result == {"structured_response": f"ok from {FALLBACK}"}
    assert calls == [PRIMARY, FALLBACK]


async def test_exhausted_model_is_skipped_on_subsequent_calls():
    """The point of the registry: a fan-out across dozens of lessons must not
    re-discover the same wall once per branch."""
    calls: list[str] = []
    factory = _factory({PRIMARY: _FakeRateLimit(DAILY_MESSAGE)}, calls)

    await ainvoke_with_fallback(factory, {"messages": []})
    calls.clear()
    await ainvoke_with_fallback(factory, {"messages": []})

    assert calls == [FALLBACK], "primary should not be retried during cooldown"


async def test_raises_all_models_exhausted_when_the_chain_runs_out():
    daily = _FakeRateLimit(DAILY_MESSAGE)
    factory = _factory({model: daily for model in model_chain("generation")}, [])

    with pytest.raises(AllModelsExhausted) as excinfo:
        await ainvoke_with_fallback(factory, {"messages": []})
    assert "exhausted" in str(excinfo.value)


async def test_non_quota_errors_propagate_without_burning_the_chain():
    """A bug in the prompt or schema must not silently consume every model's
    budget looking for one that tolerates it."""
    calls: list[str] = []
    factory = _factory({model: RuntimeError("boom") for model in model_chain()}, calls)

    with pytest.raises(RuntimeError):
        await ainvoke_with_fallback(factory, {"messages": []})
    assert calls == [PRIMARY], "should stop at the first model, not walk the chain"


async def test_config_is_forwarded_to_the_agent():
    """The tutor graph passes a thread config for checkpointing; losing it
    would silently break conversation memory."""
    seen = {}

    class _ConfigAgent:
        async def ainvoke(self, payload, config=None):
            seen["config"] = config
            return {"structured_response": "ok"}

    await ainvoke_with_fallback(
        lambda model: _ConfigAgent(),
        {"messages": []},
        config={"configurable": {"thread_id": "7-3"}},
    )
    assert seen["config"] == {"configurable": {"thread_id": "7-3"}}


# --- a request bigger than the model's whole allowance --------------------
#
# The third failure mode, and the one that killed a live run outright:
#
#   413 - Request too large for model `llama-3.1-8b-instant` ... on tokens
#   per minute (TPM): Limit 6000, Requested 6332
#
# Not "the budget is spent" (next minute's is full and still too small) and
# not a 429, so it matched neither the retry policy nor the fallback loop.

TOO_LARGE_MESSAGE = (
    "Request too large for model `llama-3.1-8b-instant` in organization `org_x` "
    "service tier `on_demand` on tokens per minute (TPM): Limit 6000, "
    "Requested 6332, please reduce your message size and try again."
)


def _too_large():
    return _FakeRateLimit(TOO_LARGE_MESSAGE, status=413)


def test_an_oversized_request_is_recognised():
    assert quota.is_request_too_large(_too_large())


def test_it_is_not_mistaken_for_a_spent_daily_budget():
    """Opposite remedies: one waits for tomorrow, the other must send less."""
    assert not quota.is_daily_quota_exhausted(_too_large())


def test_an_ordinary_burst_limit_is_not_an_oversized_request():
    assert not quota.is_request_too_large(_FakeRateLimit(BURST_MESSAGE))


def test_a_413_that_is_not_about_size_is_left_alone():
    assert not quota.is_request_too_large(_FakeRateLimit("Payload rejected", status=413))


def test_an_oversized_request_is_not_retried():
    """Retrying spends the backoff ceiling on a request that cannot fit."""
    assert not is_retryable(_too_large())


async def test_an_oversized_request_moves_to_the_next_model():
    calls: list[str] = []
    result = await ainvoke_with_fallback(_factory({PRIMARY: _too_large()}, calls), {"messages": []})

    assert result == {"structured_response": f"ok from {FALLBACK}"}
    assert calls == [PRIMARY, FALLBACK]


async def test_the_oversized_model_is_still_usable_for_smaller_calls():
    """It is not marked exhausted: the model is fine, that one request was
    not. Blocking it for an hour would strand every later call in the run."""
    calls: list[str] = []
    await ainvoke_with_fallback(_factory({PRIMARY: _too_large()}, calls), {"messages": []})

    assert not quota.is_exhausted(PRIMARY)

    calls.clear()
    await ainvoke_with_fallback(_factory({}, calls), {"messages": []})
    assert calls == [PRIMARY], "the next, smaller call should use the primary again"


async def test_a_request_too_large_for_every_model_says_so_plainly():
    """`AllModelsExhausted` would be actively misleading -- it reads as
    'try again later', and later is exactly what will not help."""
    calls: list[str] = []
    errors = {model: _too_large() for model in model_chain()}

    with pytest.raises(RequestTooLarge, match="larger than every"):
        await ainvoke_with_fallback(_factory(errors, calls), {"messages": []})


async def test_an_oversized_request_still_defers_to_a_real_exhaustion():
    """Mixed causes: the chain ran out for more than one reason, so the
    generic exhaustion error is the honest one."""
    chain = model_chain()
    errors = {chain[0]: _too_large()}
    errors.update({model: _FakeRateLimit(DAILY_MESSAGE) for model in chain[1:]})

    with pytest.raises(AllModelsExhausted):
        await ainvoke_with_fallback(_factory(errors, []), {"messages": []})


# --- the root cause: the reservation, not the prompt ----------------------

def test_classification_reserves_far_less_completion_budget_than_generation():
    """Groq counts `max_tokens` toward a request's rate-limit estimate, so the
    yes/no auditor asking for the full generation budget is what pushed a
    ~300-token prompt past a 6000 TPM limit."""
    settings = get_settings()
    assert settings.ai_classification_max_tokens < settings.ai_max_tokens


def test_the_auditors_reservation_fits_inside_the_smallest_model_limit():
    """6000 TPM is the smallest limit in the configured chain; the audit
    prompt plus its completion budget has to fit with room to spare."""
    assert get_settings().ai_classification_max_tokens <= 2048
