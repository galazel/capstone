"""An unattended run, and the output a stopped run leaves behind.

Two things the generator could not do before:

* run to the end without a human. Every phase parked at an `interrupt` and
  waited, so "build this and check back later" produced a certification that
  generated one artifact and then sat still until someone clicked;
* keep what it had generated when it died. Everything lived in the LangGraph
  checkpoint until the run reached the end, so an hour of authoring that
  failed at the last step showed the admin an empty certification.
"""

from __future__ import annotations

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.graphs.certification.review_mode import (
    AUTO,
    GUIDED,
    auto_approving,
    normalize_review_mode,
)

from tests.test_review_loop import CURRICULUM, graph_env, isolated_index_dir  # noqa: F401


# --- the flag itself ------------------------------------------------------

@pytest.mark.parametrize("raw", ["auto", "AUTO", " Auto ", "unattended", True])
def test_unattended_spellings_are_recognised(raw):
    assert normalize_review_mode(raw) == AUTO


@pytest.mark.parametrize("raw", [None, "", "guided", False, "supervised", "atuo", 0])
def test_anything_else_stays_supervised(raw):
    """A typo must not quietly turn a run the admin meant to watch into one
    that finishes without them."""
    assert normalize_review_mode(raw) == GUIDED


def test_approve_remaining_still_works_per_scope():
    state = {"review_mode": GUIDED, "auto_approve_scopes": ["LESSON"]}
    assert auto_approving(state, "LESSON")
    assert not auto_approving(state, "MIDDLE")
    assert not auto_approving(state)


def test_unattended_covers_every_scope():
    state = {"review_mode": AUTO}
    assert auto_approving(state)
    assert auto_approving(state, "MIDDLE")


# --- driving the real graph ----------------------------------------------

async def test_an_unattended_run_never_pauses(graph_env):  # noqa: F811
    """The whole point: one invocation, no interrupts, output for every
    phase. A guided run needs seven-plus resumes to reach this state."""
    graph, _ = graph_env

    result = await graph.ainvoke(
        {
            "certification_name": "C",
            "certification_description": "d",
            "document_refs": [],
            "review_mode": AUTO,
        },
        config={"configurable": {"thread_id": "unattended-1"}},
    )

    assert "__interrupt__" not in result, "an unattended run must not stop for review"
    assert len(result.get("lessons") or []) == 3
    assert len(result.get("middle_quizzes") or []) == 2
    assert len(result.get("major_quizzes") or []) == 2
    assert result.get("mock_exam") and result.get("diagnostic_exam")
    assert result.get("question_bank")


async def test_a_guided_run_still_stops_at_the_first_checkpoint(graph_env):  # noqa: F811
    """The default is unchanged: nothing about the new flag makes a
    supervised run less supervised."""
    graph, _ = graph_env

    result = await graph.ainvoke(
        {"certification_name": "C", "certification_description": "d", "document_refs": []},
        config={"configurable": {"thread_id": "guided-1"}},
    )

    assert result["__interrupt__"][0].value["stage"] == "CURRICULUM"


async def test_switching_a_paused_run_to_unattended_finishes_it(graph_env):  # noqa: F811
    """What "finish without me" does. The state write is exactly what
    `certification_run.set_review_mode` performs over HTTP."""
    graph, _ = graph_env
    config = {"configurable": {"thread_id": "switch-1"}}

    paused = await graph.ainvoke(
        {"certification_name": "C", "certification_description": "d", "document_refs": []},
        config=config,
    )
    assert "__interrupt__" in paused

    await graph.aupdate_state(config, {"review_mode": AUTO})
    from langgraph.types import Command

    result = await graph.ainvoke(Command(resume="approve"), config=config)

    assert "__interrupt__" not in result
    assert len(result.get("lessons") or []) == 3
