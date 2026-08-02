"""Rate-limit classification and per-model quota state.

A 429 is several different failures wearing one status code, and they need
opposite remedies:

* **Burst limits** (per-minute) clear in seconds. Backing off and retrying the
  same model is correct, and `app.ai.retry` already does exactly that.
* **Daily limits** clear hours later::

      Rate limit reached for model `llama-3.3-70b-versatile` ... on tokens
      per day (TPD): Limit 100000, Used 96604, Requested 9985.
      Please try again in 1h34m52.896s

  The retry policy's ceiling is 60s across 5 attempts, so *every* attempt
  against a spent daily budget is guaranteed to fail. Retrying only converts
  an immediate failure into a failure three minutes later; the generation run
  is lost either way.

The remedy for the second case is a different model, not a longer sleep, and
budgets are scoped per model -- note the error names one. So this module
supplies two things: telling the cases apart, and remembering which models are
spent, so later calls in the same run skip them instead of rediscovering the
wall one by one.

Routing through OpenRouter adds two failures a single-vendor client never sees,
and both are classified here because both change what the caller should do:

* **402 / "insufficient credits"** is account-level. No model in any chain will
  work, so it must *not* trigger a fallback walk (`is_out_of_credits`).
* **502 / "Provider returned error"** means OpenRouter is fine and the vendor
  behind that one slug is not. Neither a rate limit nor a bug here; the remedy
  is a model from a different vendor (`is_upstream_unavailable`).

Error *text* is matched defensively rather than exactly. OpenRouter forwards
each upstream vendor's own message, so the wording varies by which company's
model was being called, and pinning exact strings would silently stop matching.
Status codes are the primary signal; text only narrows.

State is per-process and in-memory: it is a cache, not a ledger. A restart
re-discovers exhaustion on the next call, which costs one wasted request.
"""

from __future__ import annotations

import logging
import re
import time

logger = logging.getLogger(__name__)

#: Markers for the *daily* buckets. Per-minute buckets read "tokens per minute
#: (TPM)" / "requests per minute (RPM)" instead, and those must stay retryable
#: rather than triggering a model swap. OpenRouter's own free-tier limit says
#: "per day", and forwarded upstream messages use the TPD/RPD spellings.
_DAILY_MARKERS = ("per day", "per-day", "(tpd)", "(rpd)", "daily limit", "daily quota")

#: Markers for an exhausted OpenRouter balance. Paired with a status check --
#: 402 alone is enough, but some upstreams surface the same condition as a 429
#: whose text says "credit", and treating that as a rate limit would send the
#: run down a fallback chain where every model fails identically.
_CREDIT_MARKERS = (
    "insufficient credit",
    "insufficient_quota",
    "more credits",
    "add credits",
    "negative credit",
    "payment required",
    "exceeded your current quota",
)

#: Markers for "the vendor behind this model failed", as forwarded by
#: OpenRouter. Distinct from OpenRouter itself being down, which is an ordinary
#: 5xx and is retried rather than routed around.
_UPSTREAM_MARKERS = (
    "provider returned error",
    "no allowed providers",
    "no endpoints found",
    "upstream error",
    "overloaded",
)

#: Matches the tail of "Please try again in 1h34m52.896s". Every component is
#: optional -- short waits appear as bare seconds.
_RETRY_AFTER_RE = re.compile(
    r"try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?", re.IGNORECASE
)

#: model name -> monotonic deadline after which it is worth trying again.
_exhausted: dict[str, float] = {}


def _message(exc: BaseException) -> str:
    """The provider's error text, including anything forwarded from upstream.

    Read defensively: `body` is `object | None` on the SDK exception and holds
    raw response text when the error wasn't valid JSON.

    OpenRouter puts its own summary in `error.message` and the vendor's verbatim
    response in `error.metadata` (as `raw`, or as a nested provider payload).
    The distinguishing detail is often only in the latter -- "Provider returned
    error" says nothing about *which* error -- so both are returned, joined,
    and every predicate below searches the whole thing.
    """
    parts: list[str] = []
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str):
                parts.append(message)
            metadata = error.get("metadata")
            if isinstance(metadata, dict):
                parts.append(str(metadata))
            elif isinstance(metadata, str):
                parts.append(metadata)
    if not parts:
        return str(exc)
    parts.append(str(exc))
    return "\n".join(parts)


def message_of(exc: BaseException) -> str:
    """Public alias for the provider's error text.

    Exists so `app.ai.router` can quote the provider verbatim when it raises
    `OutOfCredits`. The remedy for a 402 is genuinely ambiguous -- add credit,
    *or* reserve fewer tokens -- and only the provider's own message says which
    number was too big.
    """
    return _message(exc)


def _status(exc: BaseException) -> int | None:
    return getattr(exc, "status_code", None)


def is_rate_limit(exc: BaseException) -> bool:
    return _status(exc) == 429


def is_out_of_credits(exc: BaseException) -> bool:
    """True when the *account* is out of money, not the model out of budget.

    OpenRouter answers 402 for this. It is separated from every other failure
    here because it is the only one where trying another model is actively
    wrong: credit is billed per account, so the fallback chain would spend five
    more requests confirming the same thing and then report "all models
    exhausted", which points the operator at the model table instead of at the
    billing page.

    Also matched on a 429 whose text names credit rather than a rate: some
    upstream vendors report an empty balance that way.
    """
    text = _message(exc).lower()
    if _status(exc) == 402:
        return True
    return is_rate_limit(exc) and any(marker in text for marker in _CREDIT_MARKERS)


#: OpenRouter's free-model allowance is billed against the ACCOUNT, not against
#: a model, so every `:free` slug shares one counter::
#:
#:     429 - Rate limit exceeded: free-models-per-day. Add 10 credits to
#:     unlock 1000 free model requests per day
#:     X-RateLimit-Limit: 50, X-RateLimit-Remaining: 0
#:     limit_source: openrouter_free_tier_daily
#:
#: That makes it look exactly like per-model daily exhaustion and behave like
#: the credits case: walking the chain cannot help, because the second model
#: draws on the same spent counter. Measured live -- the router spent one
#: request per model in the chain to rediscover a single account-wide fact.
_ACCOUNT_CAP_MARKERS = ("free-models-per-day", "openrouter_free_tier_daily")


def is_account_daily_cap(exc: BaseException) -> bool:
    """True when the whole account's free-model allowance is spent for the day.

    Distinct from `is_daily_quota_exhausted`, which is per model and *is* worth
    a fallback. Here every model in every chain is equally unavailable until the
    reset, so the only honest responses are to wait or to add credit.
    """
    if not is_rate_limit(exc):
        return False
    text = _message(exc).lower()
    return any(marker in text for marker in _ACCOUNT_CAP_MARKERS)


def is_daily_quota_exhausted(exc: BaseException) -> bool:
    """True for a 429 against a per-day bucket, i.e. one that backoff cannot
    outlast and that should move the caller to another model.

    Excludes the credit and account-cap cases explicitly: both arrive as a 429
    mentioning a daily allowance, and routing either here would start a fallback
    walk that cannot succeed.
    """
    if is_out_of_credits(exc) or is_account_daily_cap(exc):
        return False
    return is_rate_limit(exc) and any(
        marker in _message(exc).lower() for marker in _DAILY_MARKERS
    )


def is_upstream_unavailable(exc: BaseException) -> bool:
    """True when OpenRouter reached the vendor and the vendor failed.

        502 - Provider returned error

    A gateway-shaped failure that is really a per-model one: the other models
    in the chain sit behind different companies and are unaffected. Retrying
    this slug is the wrong move -- a vendor outage outlasts a 60s backoff --
    so the router advances the chain instead.

    Note this must not swallow OpenRouter's *own* 5xx, which is transient and
    is retried: that is why 500 and 503 are absent, and why 502 still requires
    the text to name a provider.
    """
    status = _status(exc)
    text = _message(exc).lower()
    if status in (502, 503) and any(marker in text for marker in _UPSTREAM_MARKERS):
        return True
    # OpenRouter reports "no endpoints found for <model>" as a 404 when every
    # provider for a slug is offline or filtered out. Same remedy, and unlike a
    # normal 404 it is not a caller mistake.
    return status == 404 and "no endpoints found" in text


def is_request_too_large(exc: BaseException) -> bool:
    """True when one request is bigger than the model will accept at all::

        413 - Request too large for model `llama-3.1-8b-instant` ... on tokens
        per minute (TPM): Limit 6000, Requested 6332, please reduce your
        message size and try again.

        400 - This model's maximum context length is 128000 tokens, however
        you requested 141238 tokens.

    A failure mode distinct from every case above and needing a different
    remedy. It is not "the budget is spent" -- next minute's budget is full and
    still too small -- so waiting is futile and retrying is futile. Only a model
    with a larger window, or a smaller request, can succeed.

    Note the status is 413 or 400, not 429, so this originally matched neither
    the retry policy nor the fallback loop: it went straight to failing the run.
    The 400 form is the one that matters on OpenRouter, where a context
    overflow is a validation error rather than a rate-limit one.
    """
    status = _status(exc)
    if status not in (400, 413):
        return False
    text = _message(exc).lower()
    return any(
        marker in text
        for marker in (
            "too large",
            "maximum context length",
            "context length exceeded",
            "context_length_exceeded",
            "reduce the length",
        )
    )


def parse_retry_after(exc: BaseException) -> float | None:
    """Seconds until the limit clears -- from a response header when present,
    else from the human-readable duration in the message body.

    Returns None when neither is available, leaving the caller to fall back to
    a configured default rather than guessing zero (which would hot-loop).
    """
    headers = getattr(getattr(exc, "response", None), "headers", None)
    if headers:
        try:
            raw = headers.get("retry-after")
        except AttributeError:
            raw = None
        if raw:
            try:
                return float(raw)
            except (TypeError, ValueError):
                pass

        # OpenRouter does not send `retry-after` on its own rate limits; it
        # sends `x-ratelimit-reset` as a Unix timestamp in *milliseconds*.
        # Converted to a duration here so callers keep a single unit. Guarded
        # against a stale or malformed value producing a negative cooldown,
        # which `mark_exhausted` would clamp to zero and hot-loop on.
        try:
            reset = headers.get("x-ratelimit-reset")
        except AttributeError:
            reset = None
        if reset:
            try:
                seconds = float(reset) / 1000.0 - time.time()
            except (TypeError, ValueError):
                seconds = 0.0
            if seconds > 0:
                return seconds

    match = _RETRY_AFTER_RE.search(_message(exc))
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    if not any((hours, minutes, seconds)):
        return None
    return float(hours or 0) * 3600 + float(minutes or 0) * 60 + float(seconds or 0)


def mark_exhausted(model: str, seconds: float) -> None:
    """Records that `model` is unusable for the next `seconds` -- because its
    budget is spent, or because its upstream provider is failing.

    Takes the later of any existing deadline so a shorter, less informative
    429 cannot shorten a cooldown already set by a longer one.
    """
    deadline = time.monotonic() + max(seconds, 0.0)
    _exhausted[model] = max(deadline, _exhausted.get(model, 0.0))
    logger.warning(
        "Model %s unavailable; skipping it for %.0f min", model, seconds / 60
    )


def is_exhausted(model: str) -> bool:
    deadline = _exhausted.get(model)
    if deadline is None:
        return False
    if time.monotonic() >= deadline:
        del _exhausted[model]
        return False
    return True


def seconds_until_available(model: str) -> float:
    deadline = _exhausted.get(model)
    if deadline is None:
        return 0.0
    return max(0.0, deadline - time.monotonic())


def reset() -> None:
    """Clears all quota state. For tests, and for an admin-triggered retry
    that shouldn't wait out a cooldown recorded before a config change."""
    _exhausted.clear()
