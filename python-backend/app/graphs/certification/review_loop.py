"""Per-item review loop shared by the major, middle, and lesson phases.

The certification graph used to fan every item out in parallel and take a
single review covering all of them, so an admin could not approve category 1
and reject category 2. This replaces that with a cursor-driven sequential
walk: one item is generated, validated, and reviewed before the next starts.

The three phases differ only in what they iterate over and what they
generate, so the loop is defined once here and parameterised, rather than
copy-pasted three times with three chances to diverge.

Review actions: Approve, Edit, Improve with AI, Regenerate, Reject,
Approve Remaining. Every version of every artifact is retained.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

from langgraph.graph import END
from langgraph.types import interrupt

from app.core.config import get_settings
from app.graphs.cancellation import is_cancel_requested
from app.graphs.certification.review_mode import auto_approving
from app.graphs.certification.state import CertificationState
from app.graphs.instrumentation import instrument

logger = logging.getLogger(__name__)

# Review decisions the admin can return.
#
# The original brief specifies Approve / Edit Manually / Improve with AI /
# Regenerate / Reject; Q4 later added Approve Remaining to cut repetitive
# clicks. This is the union of both -- a UI may surface a subset, but the
# graph supports all six.
APPROVE = "approve"
REJECT = "reject"
REGENERATE = "regenerate"
APPROVE_REMAINING = "approve_remaining"
EDIT = "edit"
IMPROVE = "improve"

ALL_ACTIONS = [APPROVE, EDIT, IMPROVE, REGENERATE, REJECT, APPROVE_REMAINING]

#: The workspace calls REJECT "Skip", which describes the effect better: the
#: item is left out and the walk moves on, rather than the run failing. Both
#: spellings are accepted on the wire so the UI vocabulary and the graph's
#: internal vocabulary can each stay natural.
SKIP = "skip"
_ACTION_ALIASES = {SKIP: REJECT}

#: What a client may send, including aliases.
ACCEPTED_ACTIONS = [*ALL_ACTIONS, SKIP]


def normalize_action(action: str | None) -> str:
    """Maps wire vocabulary onto the graph's canonical actions."""
    return _ACTION_ALIASES.get(action, action or APPROVE)

#: Move to the next item.
_ADVANCING = {APPROVE, REJECT, APPROVE_REMAINING}
#: Re-run generation for the same item. IMPROVE differs from REGENERATE only
#: in that it carries admin instructions the generator reads.
_REGENERATING = {REGENERATE, IMPROVE}


@dataclass(frozen=True)
class LoopPhase:
    """One phase of the per-item walk."""

    #: "MAJOR" | "MIDDLE" | "LESSON" -- also the auto-approve scope key.
    scope: str
    #: State key holding this phase's cursor.
    cursor_key: str
    #: Extracts the ordered item list for this phase from the curriculum.
    items_of: Callable[[dict], list[Any]]
    #: Human label for one item, used in review payloads and logs.
    label_of: Callable[[Any], str]
    #: Optional boundary test: True while the item under the cursor still
    #: belongs to the parent currently being walked. The lesson phase uses it
    #: to stop at the end of a middle category so that category's quiz can be
    #: written from the lessons just authored, rather than running through
    #: every lesson in the certification first. Absent means "walk to the end".
    in_scope: Callable[[CertificationState], bool] | None = None

    @property
    def gate(self) -> str:
        return f"{self.scope.lower()}_gate"

    @property
    def generate(self) -> str:
        return f"{self.scope.lower()}_generate"

    @property
    def validate(self) -> str:
        return f"{self.scope.lower()}_validate"

    @property
    def review(self) -> str:
        return f"{self.scope.lower()}_review"

    @property
    def advance(self) -> str:
        return f"{self.scope.lower()}_advance"


def current_index(state: CertificationState, phase: LoopPhase) -> int:
    return state.get(phase.cursor_key, 0) or 0


def current_item(state: CertificationState, phase: LoopPhase) -> Any | None:
    items = phase.items_of(state.get("curriculum", {}) or {})
    index = current_index(state, phase)
    return items[index] if index < len(items) else None


def make_gate_node(phase: LoopPhase):
    """No-op anchor. Exists because a conditional edge needs a source node,
    and the routing function itself cannot also be registered as a node."""

    def gate(state: CertificationState):
        return {}

    gate.__name__ = f"{phase.gate}_node"
    return gate


def make_gate_router(phase: LoopPhase):
    """Continue through this phase, or fall through to the next one."""

    def route(state: CertificationState) -> str:
        # The cooperative cancellation boundary. Between items rather than
        # mid-generation, because an in-flight LLM call cannot be aborted.
        if is_cancel_requested(state.get("thread_id")):
            logger.info("%s phase halting: run was cancelled", phase.scope)
            return "cancelled"

        items = phase.items_of(state.get("curriculum", {}) or {})
        index = current_index(state, phase)
        if index >= len(items):
            logger.info("%s phase complete (%d item(s))", phase.scope, len(items))
            return "exit"
        if phase.in_scope is not None and not phase.in_scope(state):
            logger.info(
                "%s phase pausing at item %d: end of the current parent", phase.scope, index
            )
            return "exit"
        return "generate"

    route.__name__ = f"route_{phase.gate}"
    return route


def _sub_reports(report: Any) -> list[dict]:
    """The scored report(s) inside a phase's `validation_report`.

    Categories store one question-batch report; the lesson phase nests two
    under "lesson" and "quiz", because a lesson is judged on its prose and on
    the quiz written from it separately.
    """
    if not isinstance(report, dict):
        return []
    if "quiz" in report or "lesson" in report:
        return [r for r in (report.get("lesson"), report.get("quiz")) if isinstance(r, dict)]
    return [report] if "score" in report else []


def _worst_score(reports: list[dict]) -> int | None:
    scores = [r.get("score") for r in reports if isinstance(r.get("score"), (int, float))]
    return min(scores) if scores else None


def _quality_feedback(reports: list[dict]) -> str:
    """The validator's findings, worst first, as instructions a generator can act on."""
    issues = [
        issue
        for report in reports
        for issue in (report.get("issues") or [])
        if isinstance(issue, dict) and issue.get("message")
    ]
    rank = {"ERROR": 0, "WARNING": 1, "INFO": 2}
    issues.sort(key=lambda i: rank.get(str(i.get("severity")).upper(), 3))
    # Enough to act on without burying the instruction that matters most.
    return "\n".join(f"- {i.get('code')}: {i.get('message')}" for i in issues[:8])


def _auto_quality_retry(state: CertificationState, phase: LoopPhase, index: int, label: str):
    """One automatic regeneration for an item the validators scored badly.

    Unattended runs approved whatever came back: the deterministic checks ran,
    produced a score, stored it for the workspace, and nothing consulted it.
    The reviewer's own "Improve with AI" path already knew how to regenerate an
    item with written feedback, so this points that machinery at the validator's
    findings for runs where there is no reviewer to read them.

    Once per item, deliberately. A second failing score means the defects are
    not the kind another sample fixes, and re-rolling costs real money for the
    same dice. INFO-only reports never trigger it -- they carry no penalty and
    so cannot drop a score below the threshold in the first place.
    """
    threshold = get_settings().auto_review_min_quality_score
    if threshold <= 0:
        return None

    key = f"{phase.scope}:{index}"
    if key in (state.get("quality_retried") or []):
        return None

    reports = _sub_reports(state.get("validation_report"))
    score = _worst_score(reports)
    if score is None or score >= threshold:
        return None

    logger.info(
        "%s '%s' scored %s, below the %d quality gate -- regenerating once "
        "with the validator's findings",
        phase.scope, label, score, threshold,
    )
    return {
        "review_decision": IMPROVE,
        "status": f"{phase.scope}_AUTO_IMPROVING",
        "review_instructions": (
            "The previous version scored "
            f"{score}/100 on automated quality checks. Fix exactly these "
            f"problems and keep everything else that was already correct:\n"
            f"{_quality_feedback(reports)}"
        ),
        "quality_retried": [*(state.get("quality_retried") or []), key],
    }


def make_review_node(phase: LoopPhase):
    """Pauses for this one item -- unless the run is unattended, or the
    reviewer already chose "Approve Remaining" for this scope, in which case
    it passes straight through so the phase can drain without further clicks."""

    def review(state: CertificationState):
        item = current_item(state, phase)
        label = phase.label_of(item) if item is not None else ""
        index = current_index(state, phase)

        if auto_approving(state, phase.scope):
            # No reviewer to read the quality report, so the gate reads it.
            retry = _auto_quality_retry(state, phase, index, label)
            if retry is not None:
                return retry
            logger.info("Auto-approving %s '%s' (no review pending)", phase.scope, label)
            return {"review_decision": APPROVE, "status": f"{phase.scope}_AUTO_APPROVED"}

        decision = interrupt(
            {
                "stage": phase.scope,
                "item_label": label,
                "item_index": index,
                "item_total": len(phase.items_of(state.get("curriculum", {}) or {})),
                "payload": _payload_for(state, phase),
                # Artifact and its quality report travel together.
                "validation_report": state.get("validation_report"),
                "actions": ALL_ACTIONS,
                # Prior versions of this artifact, so the reviewer can
                # compare or restore rather than only accept-or-regenerate.
                "versions": versions_for(state, phase, index),
            }
        )

        # Accept either a bare string or {"action": ...}.
        raw = decision if isinstance(decision, str) else (decision or {}).get("action", APPROVE)
        action = normalize_action(raw)

        update: dict[str, Any] = {
            "review_decision": action,
            "status": f"{phase.scope}_REVIEWED",
        }
        if action == APPROVE_REMAINING:
            update["auto_approve_scopes"] = [*(state.get("auto_approve_scopes") or []), phase.scope]
        if action == IMPROVE:
            update["review_instructions"] = (
                decision.get("instructions") if isinstance(decision, dict) else None
            )
        if action == EDIT:
            update["review_edited_payload"] = (
                decision.get("payload") if isinstance(decision, dict) else None
            )
            # A restore is an edit whose payload happens to be an earlier
            # version. Carrying the source revision lets it be recorded as
            # RESTORED rather than masquerading as hand-written work.
            update["review_restored_from"] = (
                decision.get("restored_from") if isinstance(decision, dict) else None
            )
        if action == REJECT:
            update["rejected_items"] = [
                *(state.get("rejected_items") or []),
                {"scope": phase.scope, "index": index, "label": label},
            ]
            logger.info("%s '%s' rejected by reviewer", phase.scope, label)
        return update

    review.__name__ = f"{phase.review}_node"
    return review


def make_review_router(phase: LoopPhase):
    """Regenerate re-runs this same item; everything else moves on."""

    def route(state: CertificationState) -> str:
        decision = state.get("review_decision", APPROVE)
        if decision == EDIT:
            return "edit"
        if decision in _REGENERATING:
            return "regenerate"
        return "advance"

    route.__name__ = f"route_after_{phase.review}"
    return route


def make_advance_node(phase: LoopPhase):
    """Moves the cursor. A node rather than router logic because LangGraph
    routers must not mutate state."""

    def advance(state: CertificationState):
        return {
            phase.cursor_key: current_index(state, phase) + 1,
            # Cleared so the next item's review can't inherit this one's
            # decision or report.
            "review_decision": None,
            "validation_report": None,
            "review_instructions": None,
            "review_edited_payload": None,
            "review_restored_from": None,
        }

    advance.__name__ = f"{phase.advance}_node"
    return advance


def _payload_for(state: CertificationState, phase: LoopPhase) -> Any:
    """The artifact the reviewer is judging for the current item."""
    index = current_index(state, phase)
    if phase.scope == "MAJOR":
        return _nth(state.get("major_quizzes"), index)
    if phase.scope == "MIDDLE":
        return _nth(state.get("middle_quizzes"), index)
    return {
        "lesson": _nth(state.get("lessons"), index),
        "quiz": _nth(state.get("lesson_quizzes"), index),
    }


def _nth(items: list | None, index: int) -> Any:
    items = items or []
    return items[index] if index < len(items) else None


def register_phase(
    workflow,
    phase: LoopPhase,
    *,
    generate_node,
    validate_node,
    exit_to: str,
    apply_edit_fn: Callable[[CertificationState, Any], dict],
    generate_chain: list[tuple[str, Any]] | None = None,
    advance_router: Callable[[CertificationState], str] | None = None,
    advance_targets: dict[str, str] | None = None,
) -> None:
    """Wires one phase's five nodes and two conditional edges.

    `generate_chain` lets a phase run several generation nodes in order
    (lessons generate content *then* a quiz) before validation.

    `advance_router` sends the walk somewhere other than straight back to this
    phase's own gate once the cursor moves. The certification walk is nested --
    lessons, then their middle category's quiz, then back to the next middle's
    lessons -- so finishing a middle category hands control back to the lesson
    phase rather than to the next middle. Without it each phase could only run
    to completion before the next began, which is what forced category quizzes
    to be written before the lessons they test existed.
    """
    workflow.add_node(phase.gate, make_gate_node(phase))
    # Generation and validation are instrumented so the workspace timeline shows
    # "lesson 3 of 20, validating" with real durations. Gate/advance are
    # no-op bookkeeping and review already emits review.waiting, so neither is
    # wrapped -- they would only add noise to the panel a human reads.
    workflow.add_node(phase.validate, instrument(validate_node, phase.validate))
    workflow.add_node(phase.review, make_review_node(phase))
    workflow.add_node(phase.advance, make_advance_node(phase))
    edit_name = f"{phase.scope.lower()}_apply_edit"
    workflow.add_node(edit_name, make_apply_edit_node(phase, apply_edit_fn))

    if generate_chain:
        for name, node in generate_chain:
            workflow.add_node(name, instrument(node, name))
        first = generate_chain[0][0]
        for (name, _), (next_name, _) in zip(generate_chain, generate_chain[1:]):
            workflow.add_edge(name, next_name)
        workflow.add_edge(generate_chain[-1][0], phase.validate)
    else:
        workflow.add_node(phase.generate, instrument(generate_node, phase.generate))
        first = phase.generate
        workflow.add_edge(phase.generate, phase.validate)

    workflow.add_conditional_edges(
        phase.gate,
        make_gate_router(phase),
        {"generate": first, "exit": exit_to, "cancelled": END},
    )
    workflow.add_edge(phase.validate, phase.review)
    workflow.add_conditional_edges(
        phase.review,
        make_review_router(phase),
        {"advance": phase.advance, "regenerate": first, "edit": edit_name},
    )
    # A manual edit is accepted as-is and moves on; it is not re-validated,
    # because the reviewer's judgement supersedes the automated checks.
    workflow.add_edge(edit_name, phase.advance)
    if advance_router is not None:
        workflow.add_conditional_edges(phase.advance, advance_router, advance_targets)
    else:
        workflow.add_edge(phase.advance, phase.gate)


# --- version history -----------------------------------------------------
# Versions are written to `workflow_events`, not carried in graph state.
# Holding each artifact in state meant every regeneration added a blob that
# LangGraph then re-serialized into every later checkpoint -- the same write
# amplification file bytes caused before step 5. State keeps only a
# reference; the artifact is fetched from the event log by the REST/WS API.

SOURCE_AI_GENERATED = "AI_GENERATED"
SOURCE_AI_IMPROVED = "AI_IMPROVED"
SOURCE_MANUAL_EDIT = "MANUAL_EDIT"
#: Restoring an earlier version appends a *new* version carrying the old
#: artifact rather than rewinding the log. The history stays append-only, so
#: "we went back to r2 after r5 went wrong" remains visible afterwards.
SOURCE_RESTORED = "RESTORED"


def _version_key(phase: LoopPhase, index: int) -> str:
    return f"{phase.scope}:{index}"


def versions_for(state: CertificationState, phase: LoopPhase, index: int) -> list[dict]:
    """Lightweight version refs for one item, oldest first.

    Refs only -- artifacts are in the event log, which the workspace already
    streams. Keeping them out of the interrupt payload also stops review
    checkpoints from growing with every regeneration.
    """
    key = _version_key(phase, index)
    return [v for v in (state.get("version_refs") or []) if v.get("key") == key]


def record_version(
    state: CertificationState,
    phase: LoopPhase,
    *,
    artifact: Any,
    source: str,
    instructions: str | None = None,
) -> list[dict]:
    """Writes one artifact version to the event log and returns the updated
    `version_refs` for state.

    Falls back to an in-state ref with no artifact if the run is not
    registered (e.g. a direct HTTP-route run that never went through the
    consumer) -- the history is then incomplete, but nothing breaks.
    """
    index = current_index(state, phase)
    key = _version_key(phase, index)
    existing = state.get("version_refs") or []
    revision = sum(1 for v in existing if v.get("key") == key) + 1

    ref = None
    thread_id = state.get("thread_id")
    if thread_id:
        from app.db.session import SessionLocal
        from app.services import workflow_registry as registry

        try:
            with SessionLocal() as session:
                ref = registry.record_artifact_version(
                    session,
                    thread_id,
                    key=key,
                    revision=revision,
                    source=source,
                    artifact=artifact,
                    instructions=instructions,
                )
        except Exception:
            # Version history is an audit aid; losing an entry must not fail
            # the generation that produced it.
            logger.exception("Failed to record version %s r%d", key, revision)

    if ref is None:
        ref = {
            "key": key,
            "revision": revision,
            "source": source,
            "instructions": instructions,
            "event_seq": None,
        }

    return [*existing, ref]


def source_for_decision(state: CertificationState) -> str:
    """AI_IMPROVED when the admin supplied guidance, otherwise AI_GENERATED."""
    return SOURCE_AI_IMPROVED if state.get("review_instructions") else SOURCE_AI_GENERATED


def make_apply_edit_node(phase: LoopPhase, apply_fn: Callable[[CertificationState, Any], dict]):
    """Replaces the current item's artifact with the reviewer's own version.

    `apply_fn` knows which state key this phase writes to; the version
    bookkeeping is shared.
    """

    def apply_edit(state: CertificationState):
        payload = state.get("review_edited_payload")
        if payload is None:
            logger.warning(
                "%s edit requested with no payload; keeping the generated version", phase.scope
            )
            return {}

        restored_from = state.get("review_restored_from")

        update = apply_fn(state, payload)
        update["version_refs"] = record_version(
            state,
            phase,
            artifact=payload,
            source=SOURCE_RESTORED if restored_from else SOURCE_MANUAL_EDIT,
            instructions=(
                f"Restored from revision {restored_from}" if restored_from else None
            ),
        )
        update["review_restored_from"] = None
        update["status"] = (
            f"{phase.scope}_RESTORED" if restored_from else f"{phase.scope}_EDITED"
        )
        return update

    apply_edit.__name__ = f"{phase.scope.lower()}_apply_edit_node"
    return apply_edit
