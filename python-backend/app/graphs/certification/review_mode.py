"""Whether a run stops for a human, or generates straight through.

The graph was built HITL-first: every phase parks at an `interrupt` and waits
for an admin. That is the right default for a curriculum someone intends to
edit as it is written, and the wrong one for the far more common case of
"build this and tell me when it's done" -- there the pauses are the whole
cost, because a run left parked overnight is a run that generated nothing
overnight.

So the mode is per-run and chosen by whoever starts it:

* ``GUIDED`` -- pause at every review, as before. Still the default when
  nothing says otherwise, so an existing caller keeps its behaviour.
* ``AUTO`` -- never interrupt. Every review node approves and moves on.

It is deliberately one flag read by every review site rather than a
pre-seeded `auto_approve_scopes` list: the per-scope list only covers the
three per-item phases, so a run seeded that way would still have stopped four
more times (curriculum, mock, diagnostic, question bank). Those are exactly
the pauses that stranded runs.

A GUIDED run can be switched to AUTO mid-flight -- see
`certification_run.set_review_mode`, behind the workspace's "finish without
me" action. The reverse is not offered: a run already generating unattended
has nothing to hand back to.
"""

from __future__ import annotations

GUIDED = "GUIDED"
AUTO = "AUTO"

#: Spellings a client may send for AUTO. The UI says "unattended", the API
#: says "auto", and older callers may pass a bare boolean.
_AUTO_ALIASES = {"auto", "unattended", "true", "1", "skip", "skip_review", "no_review"}


def normalize_review_mode(raw: object) -> str:
    """Maps whatever a caller sent onto GUIDED or AUTO, defaulting to GUIDED.

    Anything unrecognised is GUIDED on purpose: a typo must not silently turn
    a run an admin meant to supervise into one that publishes past them.
    """
    if raw is True:
        return AUTO
    if raw is None or raw is False:
        return GUIDED
    return AUTO if str(raw).strip().lower() in _AUTO_ALIASES else GUIDED


def review_mode_of(state: dict) -> str:
    return normalize_review_mode(state.get("review_mode"))


def auto_approving(state: dict, scope: str | None = None) -> bool:
    """Whether this review site should pass through instead of interrupting.

    Two independent reasons to skip: the whole run is unattended, or the
    reviewer chose "Approve Remaining" for this particular scope.
    """
    if review_mode_of(state) == AUTO:
        return True
    return scope is not None and scope in (state.get("auto_approve_scopes") or [])
