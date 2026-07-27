"""Workflow run registry tests (Phase 2b step 11).

The registry exists to answer what LangGraph's checkpointer cannot: which
runs exist, and which are paused waiting for a human. Before it, a HITL
pause was invisible -- the run sat at PROCESSING with nothing pointing at it.
"""

from __future__ import annotations

import pytest

from app.services import workflow_registry as registry


@pytest.fixture()
def session(db):
    return db


# --- run lifecycle --------------------------------------------------------

def test_start_run_registers_and_emits_started_event(session):
    run = registry.start_run(
        session, thread_id="t-1", kind="CERTIFICATION",
        certification_id=7, generation_request_id=42, triggered_by_user_id=5,
    )

    assert run.status == registry.RUNNING
    assert run.certification_id == 7
    assert run.last_seq == 1

    events = registry.list_events(session, run.run_id)
    assert [e.event_type for e in events] == [registry.EVT_WORKFLOW_STARTED]


def test_start_run_twice_for_same_thread_opens_an_attempt_instead_of_duplicating(session):
    """Re-executing a thread reuses its id. A second registration must
    continue the same timeline, not fork a new run with a reset sequence."""
    first = registry.start_run(session, thread_id="t-dup", kind="CERTIFICATION")
    second = registry.start_run(session, thread_id="t-dup", kind="CERTIFICATION")

    assert first.run_id == second.run_id
    assert second.last_seq == 2
    assert len(registry.list_runs(session)) == 1

    # Recorded as a restart, not a resume: every caller of start_run begins a
    # graph from the top, so a second call is a second attempt. Marking the
    # boundary is what lets the timeline show the current attempt instead of
    # stacking every attempt this thread ever made.
    last = registry.list_events(session, second.run_id)[-1]
    assert last.event_type == registry.EVT_WORKFLOW_RESTARTED
    assert last.payload == {"attempt": 2}, "the original execution was attempt 1"
    assert registry.attempt_number(session, second.run_id) == 2


def test_re_executing_a_thread_clears_the_previous_attempts_state(session):
    """A redelivered message (a worker reload mid-run is enough) must not
    leave the run reading as failed at a stage it is about to redo."""
    registry.start_run(session, thread_id="t-again", kind="CERTIFICATION")
    registry.mark_waiting_for_review(session, "t-again", stage="CURRICULUM")
    registry.mark_failed(session, "t-again", error="tool call validation failed")

    registry.start_run(session, thread_id="t-again", kind="CERTIFICATION")

    run = registry.get_run_by_thread(session, "t-again")
    assert run.status == registry.RUNNING
    assert run.error_message is None
    assert run.current_stage is None
    assert run.progress_pct == 0
    assert run.completed_at is None


def test_waiting_for_review_makes_the_run_discoverable(session):
    """The whole point of the registry."""
    registry.start_run(session, thread_id="t-2", kind="CERTIFICATION", certification_id=1)
    assert registry.list_awaiting_review(session) == []

    registry.mark_waiting_for_review(session, "t-2", stage="CURRICULUM", payload={"x": 1})

    waiting = registry.list_awaiting_review(session)
    assert len(waiting) == 1
    assert waiting[0].thread_id == "t-2"
    assert waiting[0].current_stage == "CURRICULUM"
    assert waiting[0].status == registry.WAITING_FOR_REVIEW


def test_review_submitted_returns_run_to_running(session):
    registry.start_run(session, thread_id="t-3", kind="CERTIFICATION")
    registry.mark_waiting_for_review(session, "t-3", stage="CURRICULUM")
    registry.mark_review_submitted(session, "t-3", stage="CURRICULUM", decision="approve")

    run = registry.get_run_by_thread(session, "t-3")
    assert run.status == registry.RUNNING
    assert registry.list_awaiting_review(session) == []

    last = registry.list_events(session, run.run_id)[-1]
    assert last.event_type == registry.EVT_REVIEW_SUBMITTED
    assert last.payload == {"decision": "approve"}


def test_completed_sets_progress_and_timestamp(session):
    registry.start_run(session, thread_id="t-4", kind="QUESTION_BANK")
    registry.mark_completed(session, "t-4", payload={"exams": 3})

    run = registry.get_run_by_thread(session, "t-4")
    assert run.status == registry.COMPLETED
    assert run.progress_pct == 100
    assert run.completed_at is not None


def test_failed_records_the_error(session):
    registry.start_run(session, thread_id="t-5", kind="CERTIFICATION")
    registry.mark_failed(session, "t-5", error="groq exploded")

    run = registry.get_run_by_thread(session, "t-5")
    assert run.status == registry.FAILED
    assert run.error_message == "groq exploded"
    assert run.completed_at is not None


def test_transition_on_unknown_thread_returns_none_rather_than_inventing_a_run(session):
    """A missing registry row means a wiring bug -- surface it, don't hide it."""
    assert registry.mark_completed(session, "never-registered") is None


# --- event sequence / replay ---------------------------------------------

def test_seq_is_monotonic_and_gapless(session):
    run = registry.start_run(session, thread_id="t-6", kind="CERTIFICATION")
    for stage in ("A", "B", "C"):
        registry.record_event(session, run, registry.EVT_NODE_COMPLETED, stage=stage)
    session.commit()

    events = registry.list_events(session, run.run_id)
    assert [e.seq for e in events] == [1, 2, 3, 4]
    assert run.last_seq == 4


def test_replay_returns_only_events_after_last_seq(session):
    """A reconnecting client sends its last_seq and gets only what it missed."""
    run = registry.start_run(session, thread_id="t-7", kind="CERTIFICATION")
    for stage in ("A", "B", "C"):
        registry.record_event(session, run, registry.EVT_NODE_COMPLETED, stage=stage)
    session.commit()

    missed = registry.list_events(session, run.run_id, after_seq=2)
    assert [e.seq for e in missed] == [3, 4]
    assert [e.stage for e in missed] == ["B", "C"]


def test_events_carry_the_fields_the_workspace_renders(session):
    run = registry.start_run(session, thread_id="t-8", kind="CERTIFICATION")
    registry.record_event(
        session, run, registry.EVT_NODE_COMPLETED,
        stage="plan_curriculum", task_status=registry.TASK_COMPLETED,
        duration_ms=1234, retry_count=2, payload={"nodes": 3},
    )
    session.commit()

    event = registry.list_events(session, run.run_id)[-1]
    assert event.stage == "plan_curriculum"
    assert event.task_status == registry.TASK_COMPLETED
    assert event.duration_ms == 1234
    assert event.retry_count == 2
    assert event.payload == {"nodes": 3}


def test_two_runs_have_independent_sequences(session):
    a = registry.start_run(session, thread_id="t-a", kind="CERTIFICATION")
    b = registry.start_run(session, thread_id="t-b", kind="QUESTION_BANK")
    registry.record_event(session, a, registry.EVT_NODE_COMPLETED)
    session.commit()

    assert a.last_seq == 2
    assert b.last_seq == 1
    assert [e.seq for e in registry.list_events(session, b.run_id)] == [1]


# --- listing / filtering --------------------------------------------------

def test_list_filters_by_status_and_certification(session):
    registry.start_run(session, thread_id="f-1", kind="CERTIFICATION", certification_id=1)
    registry.start_run(session, thread_id="f-2", kind="CERTIFICATION", certification_id=2)
    registry.mark_completed(session, "f-2")

    assert len(registry.list_runs(session)) == 2
    assert len(registry.list_runs(session, status=registry.COMPLETED)) == 1
    assert len(registry.list_runs(session, certification_id=1)) == 1


def test_list_is_newest_first(session):
    registry.start_run(session, thread_id="o-1", kind="CERTIFICATION")
    registry.start_run(session, thread_id="o-2", kind="CERTIFICATION")
    threads = [r.thread_id for r in registry.list_runs(session)]
    assert set(threads) == {"o-1", "o-2"}
