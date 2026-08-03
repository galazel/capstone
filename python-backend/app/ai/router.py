"""Model fallback for a task whose model cannot serve it right now.

`app.ai.retry` covers failures that clear on their own. This covers the ones
that do not clear inside any backoff worth waiting through: a model whose daily
budget is gone for hours, and an upstream provider that OpenRouter cannot reach
at all. Instead of failing a curriculum or question run outright, the call walks
that task's configured chain of models and reissues against the next one.

Why this takes a *factory* rather than a built agent: `create_agent()` bakes the
model into the agent at construction, so switching models means rebuilding.
The agent factories are `lru_cache`d per model name, so rebuilding costs one
dictionary lookup after the first time.

Note what is deliberately *not* a fallback: running out of OpenRouter credits.
That is an account-level failure, so every model in the chain would fail the
same way -- see `no_credit_remaining` below.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from app.ai import quota
from app.ai.quota import (
    is_account_daily_cap,
    is_daily_quota_exhausted,
    is_exhausted,
    is_out_of_credits,
    is_request_too_large,
    is_upstream_unavailable,
    mark_exhausted,
    parse_retry_after,
    seconds_until_available,
)
from app.ai.retry import retry_llm_call
from app.ai.tasks import profile_for
from app.core.config import get_settings

logger = logging.getLogger(__name__)

#: How long a model is skipped after its upstream provider returned an error.
#: Much shorter than a quota cooldown: a vendor outage is usually minutes, and
#: over-long avoidance would keep a whole run on its fallback after the primary
#: recovered. Long enough, though, to spare the remaining lessons in a fan-out
#: from each paying one failed call to learn the same thing.
_UPSTREAM_COOLDOWN_SECONDS = 120.0


class AllModelsExhausted(RuntimeError):
    """Every model in the chain is rate limited or unreachable.

    Distinct from the provider's RateLimitError so callers can tell "wait and
    it will work" apart from "nothing in this chain will work today".
    """


class OutOfCredits(RuntimeError):
    """The OpenRouter account has no credit left.

    Its own class because it is the one failure here that walking the chain
    cannot help with: credit is billed per account, not per model, so the
    second model fails exactly as the first did. Raised immediately so the
    operator sees "top up the account" rather than a chain of rate-limit
    warnings that suggests the wrong remedy.
    """


class RequestTooLarge(RuntimeError):
    """No model in the chain can accept a request this size.

    Separate from `AllModelsExhausted` because the remedy is the opposite:
    waiting cannot help, and the caller must send less rather than try later.
    """


def model_chain(task: str = "question") -> list[str]:
    """The configured model preference order for a task: primary, then fallbacks.

    Delegates to `app.ai.tasks`, which is also what `get_llm` reads. That
    shared source is the point: this function used to re-derive the chain from
    settings with its own branch over agent types, so a task whose model was
    changed in one place and not the other would fall back to a model it was
    never meant to use -- and nothing would report it.
    """
    return profile_for(task).chain


@retry_llm_call
async def _ainvoke_once(agent, payload: dict, config: dict | None) -> Any:
    """One model's attempt, with the shared backoff policy applied.

    Burst limits and transient 5xx are absorbed here. Daily exhaustion is
    excluded from the retry predicate (see `app.ai.retry.is_retryable`) so it
    propagates immediately to the fallback loop below instead of burning five
    attempts on a budget that will not return for hours.
    """
    if config is None:
        return await agent.ainvoke(payload)
    return await agent.ainvoke(payload, config)


async def ainvoke_with_fallback(
    build_agent: Callable[..., Any],
    payload: dict,
    *,
    task: str = "question",
    config: dict | None = None,
) -> Any:
    """Invokes `build_agent(model)`'s agent, advancing down `task`'s model chain
    whenever a model turns out to be unusable for the rest of this run.

    Raises `AllModelsExhausted` when the chain runs out, carrying the earliest
    reset time so the caller can report something more useful than a 429.
    """
    profile = profile_for(task)
    chain = profile.chain
    available = [model for model in chain if not is_exhausted(model)]

    if not available:
        wait = min(seconds_until_available(model) for model in chain)
        raise AllModelsExhausted(
            f"All {profile.name} models exhausted ({', '.join(chain)}); "
            f"earliest budget reset in {wait / 60:.0f} min"
        )

    skipped = [model for model in chain if model not in available]
    if skipped:
        logger.info("Skipping models still in cooldown: %s", ", ".join(skipped))

    last_exc: BaseException | None = None
    too_large_for: list[str] = []
    for model in available:
        try:
            return await _ainvoke_once(build_agent(model), payload, config)
        except Exception as exc:
            if is_account_daily_cap(exc):
                # Account-wide, like the credits case below: every `:free` slug
                # shares one daily counter, so the remaining models in this
                # chain would each spend a request to rediscover the same wall.
                # Measured live -- a three-model chain burned three.
                wait = parse_retry_after(exc) or get_settings().ai_quota_cooldown_seconds
                for spent in chain:
                    mark_exhausted(spent, wait)
                raise AllModelsExhausted(
                    f"OpenRouter's free-model daily allowance is spent for this "
                    f"account, so no {profile.name} model can run (they share one "
                    f"counter). Resets in {wait / 60:.0f} min; adding credit raises "
                    f"the cap. Provider said: {quota.message_of(exc)}"
                ) from exc
            if is_out_of_credits(exc):
                # Account-level, so the next model in the chain is not a
                # remedy -- it is the same wall one request later.
                #
                # The balance is checked against `max_tokens`, not against what
                # the response actually costs, so a *reservation* larger than
                # the balance is refused before a single token is generated:
                #
                #   402 - This request requires more credits, or fewer
                #   max_tokens. You requested up to 16000 tokens, but can only
                #   afford 2666.
                #
                # That second remedy is the one an operator will miss, so the
                # provider's own message is carried through verbatim rather
                # than replaced with a generic "out of credit".
                raise OutOfCredits(
                    f"OpenRouter refused the request for {model} on account balance. "
                    f"Add credits, or lower this task's ai_*_max_tokens. "
                    f"Provider said: {quota.message_of(exc)}"
                ) from exc
            if is_request_too_large(exc):
                # Deliberately *not* marked exhausted: the model is fine, this
                # one request is simply bigger than what it will accept, and
                # smaller calls later in the run should still use it.
                too_large_for.append(model)
                last_exc = exc
                logger.warning(
                    "Request exceeds %s's limit outright; trying the next model", model
                )
                continue
            if is_upstream_unavailable(exc):
                # OpenRouter reached the vendor and the vendor was down. Not a
                # budget problem, but the remedy is identical -- a model from a
                # different vendor -- so it advances the chain. The cooldown is
                # short because provider outages are usually minutes, and
                # marking it at all is what stops the next 40 lessons in the
                # same run from rediscovering the outage one call at a time.
                mark_exhausted(model, _UPSTREAM_COOLDOWN_SECONDS)
                last_exc = exc
                logger.warning(
                    "%s's upstream provider is unavailable; trying the next model", model
                )
                continue
            if not is_daily_quota_exhausted(exc):
                raise
            cooldown = parse_retry_after(exc) or get_settings().ai_quota_cooldown_seconds
            mark_exhausted(model, cooldown)
            last_exc = exc
            logger.warning("Falling back from %s to the next model in the chain", model)

    if too_large_for and len(too_large_for) == len(available):
        raise RequestTooLarge(
            f"This request is larger than every {profile.name} model will accept "
            f"({', '.join(available)}). Send less, or raise the limit."
        ) from last_exc

    raise AllModelsExhausted(
        f"All {profile.name} models exhausted ({', '.join(available)})"
    ) from last_exc
