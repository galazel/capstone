"""Per-item review loop (Phase 2b step 12).

The certification graph previously fanned every item out in parallel and
took ONE review covering all of them, so an admin could not approve
category 1 and reject category 2. These tests drive the real graph through
the loop and assert each review action behaves per Q4:
Approve / Reject / Regenerate / Approve Remaining.
"""

from __future__ import annotations

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from app.ai import invocation
from app.core.config import get_settings
from app.graphs.certification import nodes as cert_nodes
from app.graphs.certification.review_loop import (
    ALL_ACTIONS,
    APPROVE,
    APPROVE_REMAINING,
    EDIT,
    IMPROVE,
    REGENERATE,
    REJECT,
    SOURCE_AI_GENERATED,
    SOURCE_AI_IMPROVED,
    SOURCE_MANUAL_EDIT,
    LoopPhase,
    current_index,
    current_item,
)
from app.graphs.certification.workflow import build_certification_graph
from app.schemas.certification.question_schema import QuestionBatch, QuestionDraft


CURRICULUM = {
    "majorCategories": [
        {
            "name": "Major A",
            "description": "first",
            "middleCategories": [
                {"name": "Middle A1", "description": "m", "lessons": [{"name": "Lesson 1"}]}
            ],
        },
        {
            "name": "Major B",
            "description": "second",
            "middleCategories": [
                {"name": "Middle B1", "description": "m", "lessons": [{"name": "Lesson 2"}]}
            ],
        },
    ]
}


@pytest.fixture(autouse=True)
def isolated_index_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "rag_index_dir", tmp_path / "faiss_db", raising=False)


# --- phase helpers (pure) -------------------------------------------------

def test_major_phase_iterates_majors():
    assert [m["name"] for m in cert_nodes.MAJOR_PHASE.items_of(CURRICULUM)] == ["Major A", "Major B"]


def test_middle_phase_flattens_across_majors():
    names = [m["name"] for m in cert_nodes.MIDDLE_PHASE.items_of(CURRICULUM)]
    assert names == ["Middle A1", "Middle B1"]


def test_lesson_phase_flattens_across_the_whole_tree():
    names = [l["name"] for l in cert_nodes.LESSON_PHASE.items_of(CURRICULUM)]
    assert names == ["Lesson 1", "Lesson 2"]


def test_lesson_parents_resolve_by_position():
    major, middle = cert_nodes._lesson_parents(CURRICULUM, 1)
    assert major["name"] == "Major B"
    assert middle["name"] == "Middle B1"


def test_current_item_tracks_the_cursor():
    state = {"curriculum": CURRICULUM, "major_cursor": 1}
    assert current_index(state, cert_nodes.MAJOR_PHASE) == 1
    assert current_item(state, cert_nodes.MAJOR_PHASE)["name"] == "Major B"


def test_current_item_past_the_end_is_none():
    state = {"curriculum": CURRICULUM, "major_cursor": 99}
    assert current_item(state, cert_nodes.MAJOR_PHASE) is None


# --- driving the real graph ----------------------------------------------

def _question(text: str = "Q?") -> QuestionDraft:
    return QuestionDraft(
        question_type="MCQ", question=text, choices=["a", "b", "c", "d"],
        correct_choice_index=0, lesson_ref="Lesson 1",
        explanation="A sufficiently detailed explanation of the answer.",
    )


class _Recorder:
    """Counts generation calls so regeneration is observable."""

    def __init__(self):
        self.calls = 0
        self.payloads = []

    async def ainvoke(self, payload):
        self.calls += 1
        self.payloads.append(payload)
        return {"structured_response": QuestionBatch(scope="s", questions=[_question()])}


@pytest.fixture()
def graph_env(monkeypatch):
    recorder = _Recorder()
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: recorder)

    # Skip document/curriculum stages: this suite is about the loops.
    async def _validated(state):
        return {"status": "VALIDATION_PASSED"}

    async def _ingested(state):
        return {"status": "DOCUMENT_PROCESSING_COMPLETED"}

    async def _planned(state):
        return {"curriculum": CURRICULUM, "status": "CURRICULUM_CREATED"}

    async def _authored(state):
        index = current_index(state, cert_nodes.LESSON_PHASE)
        lesson = current_item(state, cert_nodes.LESSON_PHASE) or {}
        return {"lessons": [{"name": lesson.get("name"), "sections": [], "blocks": [],
                             "index": index}]}

    # The lesson auditor is a real LLM call inside lesson_validate_node.
    # Without this stub the suite hits the Groq API: slow, costly, and
    # non-deterministic.
    class _Audit:
        passed = True
        summary = ""

        def model_dump(self):
            return {"passed": True, "summary": ""}

    async def _audited(state):
        return _Audit()

    monkeypatch.setattr(cert_nodes, "_invoke_lesson_auditor", _audited)
    monkeypatch.setattr(cert_nodes, "validate_documents_node", _validated)
    monkeypatch.setattr(cert_nodes, "document_ingestion_node", _ingested)
    monkeypatch.setattr(cert_nodes, "curriculum_planning_agent_node", _planned)
    monkeypatch.setattr(cert_nodes, "lesson_content_node", _authored)

    # Rebuild so the graph binds the patched callables.
    import importlib

    from app.graphs.certification import workflow as wf
    importlib.reload(wf)
    return wf.build_certification_graph(checkpointer=InMemorySaver()), recorder


async def _run(graph, thread: str):
    return await graph.ainvoke(
        {"certification_name": "C", "certification_description": "d", "document_refs": []},
        config={"configurable": {"thread_id": thread}},
    )


async def _resume(graph, thread: str, action):
    return await graph.ainvoke(
        Command(resume=action), config={"configurable": {"thread_id": thread}}
    )


async def _start(graph, thread: str):
    """Runs to the first per-item review.

    The graph pauses at the CURRICULUM checkpoint first, before any item
    loop begins; these tests are about the loops, so that one is approved
    here.
    """
    first = await _run(graph, thread)
    assert first["__interrupt__"][0].value["stage"] == "CURRICULUM"
    return await _resume(graph, thread, APPROVE)


async def test_loop_pauses_on_the_first_item_not_after_all_of_them(graph_env):
    """The core behaviour change: review happens per item."""
    graph, _ = graph_env
    result = await _start(graph, "loop-1")

    assert "__interrupt__" in result
    value = result["__interrupt__"][0].value
    assert value["stage"] == "MAJOR"
    assert value["item_index"] == 0
    assert value["item_label"] == "Major A"
    assert value["item_total"] == 2
    # Only the first major has been generated so far.
    assert len(result.get("major_quizzes") or []) == 1


async def test_review_payload_offers_every_action(graph_env):
    """The union of the original brief's five actions and Q4's Approve
    Remaining."""
    graph, _ = graph_env
    result = await _start(graph, "loop-actions")
    assert set(result["__interrupt__"][0].value["actions"]) == {
        APPROVE, EDIT, IMPROVE, REGENERATE, REJECT, APPROVE_REMAINING
    }
    assert len(ALL_ACTIONS) == 6


async def test_approve_advances_to_the_next_item(graph_env):
    graph, _ = graph_env
    await _start(graph, "loop-2")
    result = await _resume(graph, "loop-2", APPROVE)

    value = result["__interrupt__"][0].value
    assert value["stage"] == "MAJOR"
    assert value["item_index"] == 1
    assert value["item_label"] == "Major B"


async def test_regenerate_reruns_the_same_item(graph_env):
    graph, recorder = graph_env
    await _start(graph, "loop-3")
    calls_before = recorder.calls

    result = await _resume(graph, "loop-3", REGENERATE)
    value = result["__interrupt__"][0].value

    assert value["item_index"] == 0, "regenerate must not advance the cursor"
    assert recorder.calls > calls_before, "regenerate must actually re-generate"


async def test_reject_records_the_item_and_moves_on(graph_env):
    graph, _ = graph_env
    await _start(graph, "loop-4")
    result = await _resume(graph, "loop-4", REJECT)

    assert result["__interrupt__"][0].value["item_index"] == 1
    rejected = result.get("rejected_items") or []
    assert rejected and rejected[0]["scope"] == "MAJOR" and rejected[0]["label"] == "Major A"


async def test_approve_remaining_drains_the_rest_of_the_phase(graph_env):
    """Q4: after inspecting enough, the reviewer skips the remaining clicks
    for THIS phase -- and only this phase."""
    graph, _ = graph_env
    await _start(graph, "loop-5")
    result = await _resume(graph, "loop-5", APPROVE_REMAINING)

    value = result["__interrupt__"][0].value
    # Major B was auto-approved, so the next pause is the MIDDLE phase.
    assert value["stage"] == "MIDDLE"
    assert "MAJOR" in (result.get("auto_approve_scopes") or [])
    assert len(result.get("major_quizzes") or []) == 2


async def test_approve_remaining_does_not_leak_into_later_phases(graph_env):
    graph, _ = graph_env
    await _start(graph, "loop-6")
    result = await _resume(graph, "loop-6", APPROVE_REMAINING)

    assert result["__interrupt__"][0].value["stage"] == "MIDDLE"
    assert "MIDDLE" not in (result.get("auto_approve_scopes") or [])


async def test_phases_run_in_order_major_then_middle_then_lesson(graph_env):
    graph, _ = graph_env
    await _start(graph, "loop-7")

    stages = []
    for _ in range(6):
        result = await _resume(graph, "loop-7", APPROVE_REMAINING)
        if "__interrupt__" not in result:
            break
        stages.append(result["__interrupt__"][0].value["stage"])

    assert stages[:3] == ["MIDDLE", "LESSON", "DIAGNOSTIC_EXAM"], stages


async def test_lesson_review_shows_both_the_lesson_and_its_quiz(graph_env):
    graph, _ = graph_env
    await _start(graph, "loop-8")
    await _resume(graph, "loop-8", APPROVE_REMAINING)   # drain majors
    result = await _resume(graph, "loop-8", APPROVE_REMAINING)  # drain middles

    value = result["__interrupt__"][0].value
    assert value["stage"] == "LESSON"
    assert set(value["payload"].keys()) == {"lesson", "quiz"}


async def test_validation_report_accompanies_every_review(graph_env):
    graph, _ = graph_env
    result = await _start(graph, "loop-9")
    assert result["__interrupt__"][0].value["validation_report"] is not None


# --- Edit / Improve with AI / version history ----------------------------

async def test_improve_passes_the_reviewers_feedback_to_the_generator(graph_env):
    """The only thing separating Improve from Regenerate: the admin's
    instructions must actually reach the prompt."""
    graph, recorder = graph_env
    await _start(graph, "imp-1")

    await _resume(graph, "imp-1", {"action": IMPROVE, "instructions": "harder distractors"})

    sent = str(recorder.payloads[-1])
    assert "harder distractors" in sent, "reviewer feedback never reached the model"


async def test_improve_reruns_the_same_item(graph_env):
    graph, _ = graph_env
    await _start(graph, "imp-2")
    result = await _resume(graph, "imp-2", {"action": IMPROVE, "instructions": "more scenarios"})
    assert result["__interrupt__"][0].value["item_index"] == 0


async def test_improve_records_a_new_version_without_losing_the_old_one(graph_env):
    graph, _ = graph_env
    await _start(graph, "imp-3")
    result = await _resume(graph, "imp-3", {"action": IMPROVE, "instructions": "clearer stems"})

    versions = result["__interrupt__"][0].value["versions"]
    assert len(versions) == 2, "the improved version must not overwrite its predecessor"
    assert [v["source"] for v in versions] == [SOURCE_AI_GENERATED, SOURCE_AI_IMPROVED]
    assert versions[1]["instructions"] == "clearer stems"
    assert [v["revision"] for v in versions] == [1, 2]
    # Refs, not artifacts: the review payload must not grow with each retry.
    assert all("artifact" not in v for v in versions)


async def test_edit_replaces_the_artifact_with_the_admins_version(graph_env):
    graph, _ = graph_env
    await _start(graph, "edit-1")

    edited = [{"question_type": "MCQ", "question": "Admin wrote this"}]
    result = await _resume(graph, "edit-1", {"action": EDIT, "payload": edited})

    # Advances like an approval.
    assert result["__interrupt__"][0].value["item_index"] == 1
    saved = result["major_quizzes"][0]
    assert saved["questions"] == edited


async def test_edit_is_recorded_as_a_manual_version(graph_env):
    graph, _ = graph_env
    await _start(graph, "edit-2")
    result = await _resume(
        graph, "edit-2", {"action": EDIT, "payload": [{"question": "mine"}]}
    )

    history = result.get("version_refs") or []
    major_versions = [v for v in history if v["key"] == "MAJOR:0"]
    assert [v["source"] for v in major_versions] == [SOURCE_AI_GENERATED, SOURCE_MANUAL_EDIT]


async def test_edit_without_a_payload_keeps_the_generated_version(graph_env):
    """A malformed edit must not blank the artifact."""
    graph, _ = graph_env
    await _start(graph, "edit-3")
    result = await _resume(graph, "edit-3", {"action": EDIT})

    assert result["major_quizzes"][0]["questions"], "artifact was wiped by an empty edit"


async def test_versions_are_scoped_per_item(graph_env):
    graph, _ = graph_env
    await _start(graph, "ver-1")
    await _resume(graph, "ver-1", APPROVE)          # advance to Major B
    result = await _resume(graph, "ver-1", REGENERATE)

    # Major B has two versions; Major A still has one.
    history = result.get("version_refs") or []
    assert len([v for v in history if v["key"] == "MAJOR:0"]) == 1
    assert len([v for v in history if v["key"] == "MAJOR:1"]) == 2


async def test_advancing_clears_the_previous_items_instructions(graph_env):
    """Otherwise item 2 would silently inherit item 1's improve feedback."""
    graph, recorder = graph_env
    await _start(graph, "ver-2")
    await _resume(graph, "ver-2", {"action": IMPROVE, "instructions": "only for item one"})
    await _resume(graph, "ver-2", APPROVE)   # accept the improved item 1 -> item 2

    sent = str(recorder.payloads[-1])
    assert "only for item one" not in sent
