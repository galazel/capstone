"""Rate-limit classification and per-model quota state.

A Groq 429 is two different failures wearing the same status code, and they
need opposite remedies:

* **Burst limits** (TPM / RPM) clear in seconds. Backing off and retrying the
  same model is correct, and `app.ai.retry` already does exactly that.
* **Daily limits** (TPD / RPD) clear hours later::

      Rate limit reached for model `llama-3.3-70b-versatile` ... on tokens
      per day (TPD): Limit 100000, Used 96604, Requested 9985.
      Please try again in 1h34m52.896s

  The retry policy's ceiling is 60s across 5 attempts, so *every* attempt
  against a spent daily budget is guaranteed to fail. Retrying only converts
  an immediate failure into a failure three minutes later; the generation run
  is lost either way.

The remedy for the second case is a different model, not a longer sleep.
Groq scopes each budget *per model* -- note the error names one, "for model
`llama-3.3-70b-versatile`" -- so another model draws on its own untouched
allowance. This module supplies the two things that requires: telling the
cases apart, and remembering which models are spent so later calls in the
same run skip them instead of rediscovering the wall one by one.

State is per-process and in-memory: it is a cache, not a ledger. A restart
re-discovers exhaustion on the next call, which costs one wasted request.
"""

from __future__ import annotations

import logging
import re
import time

logger = logging.getLogger(__name__)

#: Markers Groq uses for the *daily* buckets. The per-minute buckets read
#: "tokens per minute (TPM)" / "requests per minute (RPM)" instead, and those
#: must stay retryable rather than triggering a model swap.
_DAILY_MARKERS = ("per day", "(tpd)", "(rpd)")

#: Matches the tail of "Please try again in 1h34m52.896s". Every component is
#: optional -- short waits appear as bare seconds.
_RETRY_AFTER_RE = re.compile(
    r"try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?", re.IGNORECASE
)

#: model name -> monotonic deadline after which it is worth trying again.
_exhausted: dict[str, float] = {}


def _message(exc: BaseException) -> str:
    """The provider's error text.

    Read defensively: `body` is `object | None` on the SDK exception and holds
    raw response text when the error wasn't valid JSON.
    """
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str):
                return message
    return str(exc)


def is_rate_limit(exc: BaseException) -> bool:
    return getattr(exc, "status_code", None) == 429


def is_daily_quota_exhausted(exc: BaseException) -> bool:
    """True for a 429 against a per-day bucket, i.e. one that backoff cannot
    outlast and that should move the caller to another model."""
    return is_rate_limit(exc) and any(
        marker in _message(exc).lower() for marker in _DAILY_MARKERS
    )


def is_request_too_large(exc: BaseException) -> bool:
    """True when one request exceeds a model's *entire* per-minute allowance::

        413 - Request too large for model `llama-3.1-8b-instant` ... on tokens
        per minute (TPM): Limit 6000, Requested 6332, please reduce your
        message size and try again.

    A third failure mode, distinct from both cases above and needing a third
    remedy. It is not "the budget is spent" -- next minute's budget is full and
    still too small -- so waiting is futile and retrying is futile. Only a model
    with a larger limit, or a smaller request, can succeed.

    Note the status is 413, not 429, so this matched neither the retry policy
    nor the fallback loop: it went straight to failing the run.
    """
    if getattr(exc, "status_code", None) != 413:
        return False
    return "too large" in _message(exc).lower()


def parse_retry_after(exc: BaseException) -> float | None:
    """Seconds until the limit clears -- from the `retry-after` header when
    present, else from the human-readable duration in the message body.

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

    match = _RETRY_AFTER_RE.search(_message(exc))
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    if not any((hours, minutes, seconds)):
        return None
    return float(hours or 0) * 3600 + float(minutes or 0) * 60 + float(seconds or 0)


def mark_exhausted(model: str, seconds: float) -> None:
    """Records that `model` has no budget for the next `seconds`.

    Takes the later of any existing deadline so a shorter, less informative
    429 cannot shorten a cooldown already set by a longer one.
    """
    deadline = time.monotonic() + max(seconds, 0.0)
    _exhausted[model] = max(deadline, _exhausted.get(model, 0.0))
    logger.warning(
        "Model %s out of daily budget; skipping it for %.0f min", model, seconds / 60
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
