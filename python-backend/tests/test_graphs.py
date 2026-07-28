"""LangGraph structure, routing, reducer, and node tests.

These exist because of Phase 2a step 3. Previously the graph modules built
themselves at import scope and each agent module constructed a Groq client at
import scope, so *any* test touching a graph required both a live Postgres and
a GROQ_API_KEY -- which is why there were zero tests for graphs, agents, or
tools despite them being the core of the product.

Everything here runs against an InMemorySaver with stubbed agents.
"""

from __future__ import annotations

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from app.ai import invocation
from app.core.config import get_settings
from app.graphs.certification import nodes as cert_nodes
from app.graphs.certification.state import _merge_lessons, _merge_lesson_quizzes
from app.graphs.certification.workflow import build_certification_graph
from app.graphs.question_bank import nodes as qb_nodes
from app.graphs.question_bank.workflow import build_question_bank_graph
from app.schemas.certification.question_schema import QuestionBatch, QuestionDraft


@pytest.fixture(autouse=True)
def isolated_index_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "rag_index_dir", tmp_path / "faiss_db", raising=False)


def _draft(text: str) -> QuestionDraft:
    return QuestionDraft(
        question_type="MCQ",
        question=text,
        choices=["a", "b", "c", "d"],
        correct_choice_index=0,
    )


class _StubAgent:
    """Stands in for a create_agent() result: returns a fixed QuestionBatch."""

    def __init__(self, questions):
        self._batch = QuestionBatch(scope="stub", questions=questions)
        self.calls = []

    async def ainvoke(self, payload):
        self.calls.append(payload)
        return {"structured_response": self._batch}


# --- import-time purity (the step-3 regression guard) ---------------------

def test_graphs_compile_without_database_or_api_key():
    """If this fails, something reintroduced import-time or compile-time
    coupling to Postgres / the LLM provider."""
    cert = build_certification_graph(checkpointer=InMemorySaver())
    bank = build_question_bank_graph(checkpointer=InMemorySaver())
    assert cert is not None and bank is not None


def test_certification_graph_has_expected_nodes():
    """Structure after the step-12 restructure: each of the three item
    phases is a gate/generate/validate/review/advance loop rather than a
    Send() fan-out with one shared review."""
    graph = build_certification_graph(checkpointer=InMemorySaver()).get_graph()
    names = set(graph.nodes)

    for expected in [
        "validate_documents",
        "ingest_documents",
        "plan_curriculum",
        "await_curriculum_review",
        "generate_diagnostic_exam",
        "generate_mock_exam",
        "generate_question_bank",
        "await_question_bank_review",
    ]:
        assert expected in names, f"missing node: {expected}"

    for scope in ("major", "middle", "lesson"):
        for part in ("gate", "validate", "review", "advance"):
            assert f"{scope}_{part}" in names, f"missing loop node: {scope}_{part}"

    # Categories generate a quiz only; lessons author content first (Q2).
    assert "major_generate" in names
    assert "middle_generate" in names
    assert {"lesson_content", "lesson_quiz_generate"} <= names
    assert "lesson_generate" not in names, "lessons use a two-step generation chain"


# --- routing functions ----------------------------------------------------

@pytest.mark.parametrize(
    "status,expected",
    [("VALIDATION_PASSED", "continue"), ("VALIDATION_FAILED", "stop"), (None, "stop")],
)
def test_route_after_validation(status, expected):
    assert cert_nodes.route_after_validation({"status": status}) == expected


@pytest.mark.parametrize(
    "decision,expected",
    [("regenerate", "regenerate"), ("approve", "approve"), (None, "approve")],
)
def test_route_after_review(decision, expected):
    assert cert_nodes.route_after_review({"review_decision": decision}) == expected


@pytest.mark.parametrize(
    "action,expected",
    [
        ("approve", "commit"),
        ("edit", "apply_edit"),
        ("improve", "regenerate_batch"),
        ("regenerate", "regenerate_batch"),
        ("reject", "reject_batch"),
    ],
)
def test_route_after_batch_review(action, expected):
    assert qb_nodes.route_after_batch_review({"review_action": action}) == expected


@pytest.mark.parametrize(
    "generated,target,expected",
    [(0, 10, "continue"), (9, 10, "continue"), (10, 10, "done"), (11, 10, "done")],
)
def test_route_after_commit(generated, target, expected):
    state = {"generated_count": generated, "target_total": target}
    assert qb_nodes.route_after_commit(state) == expected


# --- state reducers -------------------------------------------------------

def test_merge_lessons_upserts_by_name_instead_of_appending():
    """A selective lesson retry must *replace* the failed attempt, not append
    a second copy beside it."""
    existing = [{"name": "A", "sections": ["v1"]}, {"name": "B", "sections": ["v1"]}]
    incoming = [{"name": "A", "sections": ["v2"]}]

    merged = _merge_lessons(existing, incoming)

    assert len(merged) == 2
    by_name = {item["name"]: item for item in merged}
    assert by_name["A"]["sections"] == ["v2"]
    assert by_name["B"]["sections"] == ["v1"]


def test_merge_lesson_quizzes_upserts_by_lesson():
    existing = [{"lesson": "L1", "questions": [1]}]
    incoming = [{"lesson": "L1", "questions": [2]}, {"lesson": "L2", "questions": [3]}]

    merged = _merge_lesson_quizzes(existing, incoming)

    assert len(merged) == 2
    assert {q["lesson"]: q["questions"] for q in merged} == {"L1": [2], "L2": [3]}


def test_merge_handles_empty_sides():
    assert _merge_lessons([], []) == []
    assert _merge_lessons(None, [{"name": "A"}]) == [{"name": "A"}]


# --- node behaviour with stubbed agents -----------------------------------

async def test_validate_documents_node_passes(monkeypatch):
    class Audit:
        is_related = True
        reason = ""

    async def _stub_auditor(state, samples):
        return Audit()

    monkeypatch.setattr(cert_nodes, "_invoke_auditor", _stub_auditor)
    monkeypatch.setattr(cert_nodes, "load_upload", lambda *a, **k: [])

    result = await cert_nodes.validate_documents_node(
        {"uploaded_files": [], "certification_name": "X", "certification_description": "Y"}
    )
    assert result["status"] == "VALIDATION_PASSED"


async def test_validate_documents_node_fails_with_reason(monkeypatch):
    class Audit:
        is_related = False
        reason = "unrelated to the certification"

    async def _stub_auditor(state, samples):
        return Audit()

    monkeypatch.setattr(cert_nodes, "_invoke_auditor", _stub_auditor)
    monkeypatch.setattr(cert_nodes, "load_upload", lambda *a, **k: [])

    result = await cert_nodes.validate_documents_node(
        {"uploaded_files": [], "certification_name": "X", "certification_description": "Y"}
    )
    assert result["status"] == "VALIDATION_FAILED"
    assert "unrelated" in result["error_message"]


async def test_ingestion_node_rejects_unreadable_documents(monkeypatch):
    monkeypatch.setattr(cert_nodes, "resolve_documents", lambda refs, inline: [])
    with pytest.raises(RuntimeError, match="No readable text"):
        await cert_nodes.document_ingestion_node({"uploaded_files": [{}], "certification_name": "X"})


def test_commit_batch_caps_overshoot_at_target():
    """The model is asked for `remaining` questions but isn't structurally
    limited to it, so an overshooting batch must be truncated."""
    state = {
        "current_batch": [{"q": i} for i in range(10)],
        "generated_count": 8,
        "target_total": 10,
    }
    result = qb_nodes.commit_batch_node(state)
    assert len(result["approved_questions"]) == 2
    assert result["generated_count"] == 10


# --- full graph run: HITL pause -> resume -> complete ---------------------

async def test_question_bank_graph_pauses_for_review_then_completes(monkeypatch):
    stub = _StubAgent([_draft("Q1"), _draft("Q2")])
    # Takes *_ because the agent factories are now called with a model name:
    # app.ai.router rebuilds the agent per model to fall back off an exhausted
    # daily token budget.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: stub)

    graph = build_question_bank_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "run-1"}}

    paused = await graph.ainvoke(
        {"certification_name": "Test Cert", "target_total": 2, "batch_size": 2},
        config=config,
    )
    assert "__interrupt__" in paused, "graph should pause at the HITL checkpoint"

    final = await graph.ainvoke(Command(resume={"action": "approve"}), config=config)

    assert final["generated_count"] == 2
    assert len(final["approved_questions"]) == 2
    assert final["status"] == "BATCH_COMMITTED"


async def test_review_payload_carries_the_validation_report(monkeypatch):
    """The brief requires the admin to see the artifact *and* its AI
    validation report together at each checkpoint."""
    stub = _StubAgent([_draft("Q1"), _draft("Q2")])
    # Takes *_ because the agent factories are now called with a model name:
    # app.ai.router rebuilds the agent per model to fall back off an exhausted
    # daily token budget.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: stub)

    graph = build_question_bank_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "report-run"}}

    paused = await graph.ainvoke(
        {"certification_name": "C", "target_total": 2, "batch_size": 2}, config=config
    )

    payload = paused["__interrupt__"][0].value
    assert "validation_report" in payload, "review payload has no validation report"
    report = payload["validation_report"]
    assert "score" in report and "issues" in report
    assert isinstance(report["score"], int)


async def test_validation_flags_duplicates_in_a_real_graph_run(monkeypatch):
    """End-to-end: a model that emits two near-identical questions must be
    caught before the admin sees the batch."""
    duplicate = "What is the primary purpose of a database index?"
    near_duplicate = "What is the main purpose of a database index?"
    stub = _StubAgent([_draft(duplicate), _draft(near_duplicate)])
    # Takes *_ because the agent factories are now called with a model name:
    # app.ai.router rebuilds the agent per model to fall back off an exhausted
    # daily token budget.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: stub)

    graph = build_question_bank_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "dupe-run"}}

    paused = await graph.ainvoke(
        {"certification_name": "C", "target_total": 2, "batch_size": 2}, config=config
    )

    report = paused["__interrupt__"][0].value["validation_report"]
    assert "DUPLICATE_QUESTIONS" in {issue["code"] for issue in report["issues"]}
    assert report["score"] < 100


async def test_question_bank_improve_regenerates_and_records_version(monkeypatch):
    stub = _StubAgent([_draft("Q1")])
    # Takes *_ because the agent factories are now called with a model name:
    # app.ai.router rebuilds the agent per model to fall back off an exhausted
    # daily token budget.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: stub)

    graph = build_question_bank_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "run-2"}}

    await graph.ainvoke({"certification_name": "C", "target_total": 1, "batch_size": 1}, config=config)

    # "Improve with AI" must regenerate this batch and pause again, not advance.
    paused_again = await graph.ainvoke(
        Command(resume={"action": "improve", "instructions": "harder distractors"}),
        config=config,
    )
    assert "__interrupt__" in paused_again

    state = (await graph.aget_state(config)).values
    # Refs only -- the batches themselves are in the event log now, so state
    # no longer grows with each regeneration.
    refs = state["version_refs"]
    assert len(refs) == 2
    assert refs[1]["source"] == "AI_IMPROVED"
    assert refs[1]["instructions"] == "harder distractors"
    assert "questions" not in refs[1], "artifact must not be carried in state"

    # The regeneration prompt must actually carry the admin's feedback.
    assert "harder distractors" in str(stub.calls[-1])


async def test_question_bank_edit_replaces_batch_with_admin_version(monkeypatch):
    stub = _StubAgent([_draft("AI question")])
    # Takes *_ because the agent factories are now called with a model name:
    # app.ai.router rebuilds the agent per model to fall back off an exhausted
    # daily token budget.
    monkeypatch.setattr(invocation, "get_question_generation_agent", lambda *_: stub)

    graph = build_question_bank_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "run-3"}}

    await graph.ainvoke({"certification_name": "C", "target_total": 1, "batch_size": 1}, config=config)

    edited = [{"question_type": "MCQ", "question": "Admin edited question"}]
    final = await graph.ainvoke(Command(resume={"action": "edit", "questions": edited}), config=config)

    assert final["approved_questions"] == edited
    sources = [v["source"] for v in final["version_refs"]]
    assert sources == ["AI_GENERATED", "MANUAL_EDIT"]
