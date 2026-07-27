import asyncio

from langgraph.graph import StateGraph, START, END

from app.graphs.instrumentation import instrument
from app.utils.helpers import get_checkpointer

from .nodes import (
    resolve_scope_node,
    generate_batch_node,
    validate_batch_node,
    await_batch_review_node,
    route_after_batch_review,
    apply_edit_node,
    reject_batch_node,
    commit_batch_node,
    route_after_commit,
)
from .state import QuestionBankState


def build_question_bank_graph(checkpointer):
    """`checkpointer` is injected so tests can compile against an
    InMemorySaver instead of requiring a live Postgres."""
    workflow = StateGraph(QuestionBankState)

    # The three nodes that do real work are instrumented, so the workspace
    # timeline shows batch progress with durations instead of a spinner.
    # apply_edit/reject/commit are fast state transitions and await_batch_review
    # already emits review.waiting.
    workflow.add_node("resolve_scope", instrument(resolve_scope_node, "resolve_scope"))
    workflow.add_node("generate_batch", instrument(generate_batch_node, "generate_batch"))
    workflow.add_node("validate_batch", instrument(validate_batch_node, "validate_batch"))
    workflow.add_node("await_batch_review", await_batch_review_node)
    workflow.add_node("apply_edit", apply_edit_node)
    workflow.add_node("reject_batch", reject_batch_node)
    workflow.add_node("commit_batch", commit_batch_node)

    workflow.add_edge(START, "resolve_scope")
    workflow.add_edge("resolve_scope", "generate_batch")
    # Validate before review so the admin sees the artifact and its quality
    # report together, rather than judging raw output by eye.
    workflow.add_edge("generate_batch", "validate_batch")
    workflow.add_edge("validate_batch", "await_batch_review")

    workflow.add_conditional_edges(
        "await_batch_review",
        route_after_batch_review,
        {
            "commit": "commit_batch",
            "apply_edit": "apply_edit",
            "regenerate_batch": "generate_batch",
            "reject_batch": "reject_batch",
        },
    )

    # Goes straight to commit rather than back through validate_batch: that
    # would re-enter await_batch_review and force the admin to review their
    # own edit. apply_edit_node re-validates inline instead.
    workflow.add_edge("apply_edit", "commit_batch")
    # A rejected batch just re-pauses for the admin's next decision; it does
    # not auto-regenerate (that's what "Regenerate"/"Improve with AI" are for).
    workflow.add_edge("reject_batch", "await_batch_review")

    workflow.add_conditional_edges(
        "commit_batch",
        route_after_commit,
        {
            "continue": "generate_batch",
            "done": END,
        },
    )

    return workflow.compile(checkpointer=checkpointer)


_graph = None
_graph_lock = asyncio.Lock()


async def get_question_bank_graph():
    global _graph
    if _graph is not None:
        return _graph
    async with _graph_lock:
        if _graph is None:
            _graph = build_question_bank_graph(await get_checkpointer())
    return _graph
