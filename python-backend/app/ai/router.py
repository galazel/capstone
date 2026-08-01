"""Model fallback for quota-exhausted runs.

`app.ai.retry` covers failures that clear on their own. This covers the one
that does not: a model whose daily token budget is gone for the next several
hours. Instead of failing a curriculum or question run outright, the call walks
a configured chain of models and reissues against the next one with budget left.

Why this takes a *factory* rather than a built agent: `create_agent()` bakes the
model into the agent at construction, so switching models means rebuilding.
The agent factories are `lru_cache`d per model name, so rebuilding costs one
dictionary lookup after the first time.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from app.ai.quota import (
    is_daily_quota_exhausted,
    is_exhausted,
    is_request_too_large,
    mark_exhausted,
    parse_retry_after,
    seconds_until_available,
)
from app.ai.retry import retry_llm_call
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AllModelsExhausted(RuntimeError):
    """Every model in the chain is out of daily budget.

    Distinct from the provider's RateLimitError so callers can tell "wait and
    it will work" apart from "nothing in this chain will work today".
    """


class RequestTooLarge(RuntimeError):
    """No model in the chain can accept a request this size.

    Separate from `AllModelsExhausted` because the remedy is the opposite:
    waiting cannot help, and the caller must send less rather than try later.
    """


def model_chain(agent_type: str = "generation") -> list[str]:
    """The configured model preference order: primary first, then fallbacks.

    De-duplicated, so pointing the fallback at the primary (or leaving the
    default model equal to the generation model, as shipped) cannot produce a
    chain that retries the same exhausted model twice.
    """
    settings = get_settings()
    if agent_type == "classification":
        primary = settings.ai_classification_model
        fallbacks = settings.ai_classification_fallbacks
    else:
        primary = settings.ai_generation_model
        fallbacks = settings.ai_generation_fallbacks

    candidates = [
        primary,
        *(model.strip() for model in fallbacks.split(",")),
        settings.ai_default_model,
    ]

    chain: list[str] = []
    for model in candidates:
        if model and model not in chain:
            chain.append(model)
    return chain


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
    agent_type: str = "generation",
    config: dict | None = None,
) -> Any:
    """Invokes `build_agent(model)`'s agent, advancing down the model chain
    whenever a model turns out to be out of daily budget.

    Raises `AllModelsExhausted` when the chain runs out, carrying the earliest
    reset time so the caller can report something more useful than a 429.
    """
    chain = model_chain(agent_type)
    available = [model for model in chain if not is_exhausted(model)]

    if not available:
        wait = min(seconds_until_available(model) for model in chain)
        raise AllModelsExhausted(
            f"All {agent_type} models exhausted ({', '.join(chain)}); "
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
            if is_request_too_large(exc):
                # Deliberately *not* marked exhausted: the model is fine, this
                # one request is simply bigger than its per-minute ceiling, and
                # smaller calls later in the run should still use it.
                too_large_for.append(model)
                last_exc = exc
                logger.warning(
                    "Request exceeds %s's rate limit outright; trying the next model", model
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
            f"This request is larger than every {agent_type} model's rate limit "
            f"({', '.join(available)}). Send less, or raise the limit."
        ) from last_exc

    raise AllModelsExhausted(
        f"All {agent_type} models exhausted ({', '.join(available)})"
    ) from last_exc
