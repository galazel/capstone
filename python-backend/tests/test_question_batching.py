"""Large question sets are generated in batches, not one giant call.

A 50-item mock exam wants roughly 12k completion tokens now that every MCQ
explains all four choices, against an `ai_max_tokens` ceiling of 6000. The
response was truncated, a truncated tool call is malformed, malformed output is
retried with backoff -- and the Java gateway's 120s read timeout fired first:

    io.netty.handler.timeout.ReadTimeoutException
    AiServiceException: Fetch pending review for run ... failed

Batching keeps each call inside the ceiling. Deduplication is the price: a
later batch cannot see the earlier ones, and a live 30-question run came back
with only 20 distinct stems.
"""

from __future__ import annotations

import pytest

from app.ai import invocation
from app.core.config import get_settings
from app.schemas.certification.question_schema import QuestionBatch, QuestionDraft


def _draft(text: str) -> QuestionDraft:
    return QuestionDraft(
        question_type="MCQ",
        question=text,
        choices=["a", "b", "c", "d"],
        correct_choice_index=0,
        explanation="An explanation stating what the item tests and why a is right.",
        choice_explanations=[
            "Correct: this is the defined term.",
            "Confuses it with a sibling concept.",
            "Describes a later stage of the process.",
            "Unrelated to this topic entirely.",
        ],
    )


@pytest.fixture
def recorder(monkeypatch):
    """Replaces the LLM with a counter that hands back numbered questions."""
    calls: list[str] = []

    def responder(texts):
        async def fake(_factory, prompt, **kwargs):
            calls.append(prompt)
            return QuestionBatch(scope="s", questions=[_draft(t) for t in texts(len(calls))])

        monkeypatch.setattr(invocation, "invoke_agent", fake)
        return calls

    return responder


async def test_a_small_request_is_a_single_call(recorder):
    calls = recorder(lambda n: [f"Q{i}" for i in range(5)])
    await invocation.invoke_question_agent("s", "c", "Generate exactly 5 questions.", count=5)
    assert len(calls) == 1, "batching must not add calls when one is enough"


async def test_a_large_request_is_split(recorder):
    size = get_settings().question_batch_size
    calls = recorder(lambda n: [f"batch{n}-q{i}" for i in range(size)])

    batch = await invocation.invoke_question_agent(
        "s", "c", f"Generate exactly {size * 3} questions.", count=size * 3
    )

    assert len(calls) == 3
    assert len(batch.questions) == size * 3


async def test_each_batch_states_its_own_count_overriding_the_total(recorder):
    """The caller's instructions still say "exactly 50"; a batch asking for 15
    has to override that, not sit next to it."""
    size = get_settings().question_batch_size
    calls = recorder(lambda n: [f"batch{n}-q{i}" for i in range(size)])

    await invocation.invoke_question_agent(
        "s", "c", f"Generate exactly {size * 2} questions.", count=size * 2
    )

    assert f"Generate exactly {size} questions in THIS response" in calls[0]
    assert "Ignore any other question count" in calls[0]


async def test_later_batches_are_told_what_was_already_written(recorder):
    size = get_settings().question_batch_size
    calls = recorder(lambda n: [f"batch{n}-q{i}" for i in range(size)])

    await invocation.invoke_question_agent(
        "s", "c", f"Generate exactly {size * 2} questions.", count=size * 2
    )

    assert "already written" not in calls[0], "nothing precedes the first batch"
    assert "batch1-q0" in calls[1], "the second batch must see the first's questions"


async def test_duplicates_across_batches_are_dropped(recorder):
    """Every batch returns the same questions; only one copy may survive."""
    size = get_settings().question_batch_size
    recorder(lambda n: [f"same-q{i}" for i in range(size)])

    batch = await invocation.invoke_question_agent(
        "s", "c", "Generate exactly 30 questions.", count=size * 2
    )

    stems = [q.question for q in batch.questions]
    assert len(stems) == len(set(stems)), "a duplicated question reached the exam"
    assert len(stems) == size


async def test_an_all_duplicate_batch_stops_the_run_rather_than_burning_tokens(recorder):
    size = get_settings().question_batch_size
    calls = recorder(lambda n: [f"same-q{i}" for i in range(size)])

    await invocation.invoke_question_agent(
        "s", "c", "Generate lots.", count=size * 3
    )

    # Batch 1 is all new, batch 2 is entirely duplicates -> stop. Without the
    # early exit this would run every batch plus the top-up rounds.
    assert len(calls) == 2


async def test_top_up_rounds_replace_dropped_duplicates(recorder):
    """Half of each batch repeats the previous one, so reaching the full count
    needs more rounds than the arithmetic alone suggests."""
    size = get_settings().question_batch_size
    half = size // 2

    def texts(n):
        # Overlaps the previous batch by half, so half of each is new.
        start = (n - 1) * half
        return [f"q{start + i}" for i in range(size)]

    recorder(texts)
    batch = await invocation.invoke_question_agent(
        "s", "c", "Generate them.", count=size * 2
    )

    stems = [q.question for q in batch.questions]
    assert len(stems) == len(set(stems))
    assert len(stems) > size, "top-up rounds must recover from the duplicates"


async def test_the_result_is_never_longer_than_requested(recorder):
    size = get_settings().question_batch_size
    recorder(lambda n: [f"batch{n}-q{i}" for i in range(size)])

    batch = await invocation.invoke_question_agent("s", "c", "x", count=size + 1)
    assert len(batch.questions) == size + 1


# --- mock exam fallback ----------------------------------------------------
#
# The mock exam normally imitates the real paper the planner researched
# (TOPCIT: 100 items across five question types). When that research came back
# empty there was no sensible shape to imitate, and the old fallback asked for
# all five types anyway -- guessing that an unknown exam contains programming
# and diagramming tasks, which need manual or semantic grading.


def _state(structure=None, name="Some Certification"):
    curriculum = {"majorCategories": [], "exam_structure": structure or {}}
    return {"certification_name": name, "curriculum": curriculum}


def test_a_researched_item_count_wins(monkeypatch):
    from app.core.config import get_settings
    from app.graphs.certification import nodes

    monkeypatch.setattr(get_settings(), "mock_exam_max_questions", 0, raising=False)
    assert nodes.mock_exam_count_for(_state({"total_items": 100})) == 100


def test_an_unknown_exam_falls_back_to_fifty_questions(monkeypatch):
    from app.core.config import get_settings
    from app.graphs.certification import nodes

    monkeypatch.setattr(get_settings(), "mock_exam_max_questions", 0, raising=False)
    monkeypatch.setattr(get_settings(), "mock_exam_questions", 50, raising=False)

    assert nodes.mock_exam_count_for(_state()) == 50
    assert nodes.mock_exam_count_for(_state({"total_items": 0})) == 50


def test_an_unknown_exam_is_mcq_only():
    """Every other type needs semantic or manual grading, so guessing them for
    an exam nobody could describe produces work an admin has to mark by hand."""
    from app.graphs.certification import nodes

    assert nodes.UNKNOWN_EXAM_QUESTION_TYPES == "MCQ"
    assert not nodes.exam_structure_is_known(_state())
    assert not nodes.exam_structure_is_known(_state({"total_items": 0, "question_types": []}))


def test_a_researched_structure_is_recognised_from_either_field():
    from app.graphs.certification import nodes

    assert nodes.exam_structure_is_known(_state({"total_items": 60}))
    assert nodes.exam_structure_is_known(_state({"question_types": ["MCQ", "DESCRIPTIVE"]}))


async def test_the_fallback_mock_exam_asks_for_mcq_over_every_lesson(monkeypatch):
    from app.core.config import get_settings
    from app.graphs.certification import nodes

    monkeypatch.setattr(get_settings(), "mock_exam_max_questions", 0, raising=False)
    monkeypatch.setattr(get_settings(), "mock_exam_questions", 50, raising=False)

    sent = {}

    async def fake(scope, context, instructions, *, count=None):
        sent["instructions"] = instructions
        sent["count"] = count
        return QuestionBatch(scope=scope, questions=[])

    monkeypatch.setattr(nodes, "invoke_question_agent", fake)
    await nodes.generate_mock_exam_node(_state())

    assert sent["count"] == 50
    assert "exactly 50 questions" in sent["instructions"]
    assert "types ONLY: MCQ" in sent["instructions"]
    assert "EVERY lesson" in sent["instructions"]


async def test_a_researched_mock_exam_keeps_its_own_types(monkeypatch):
    from app.core.config import get_settings
    from app.graphs.certification import nodes

    monkeypatch.setattr(get_settings(), "mock_exam_max_questions", 0, raising=False)
    sent = {}

    async def fake(scope, context, instructions, *, count=None):
        sent["instructions"] = instructions
        return QuestionBatch(scope=scope, questions=[])

    monkeypatch.setattr(nodes, "invoke_question_agent", fake)
    await nodes.generate_mock_exam_node(
        _state({"total_items": 100, "question_types": ["MCQ", "PROGRAMMING"], "notes": "3 hours"})
    )

    assert "types ONLY: MCQ, PROGRAMMING" in sent["instructions"]
    assert "exactly 100 questions" in sent["instructions"]
