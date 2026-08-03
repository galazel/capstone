"""The certification walk is bottom-up: content before the quizzes that test it.

Every assessment is generated *from* the material it assesses, so the graph has
to reach a lesson's content before that lesson's quiz, a middle category's
lessons before its quiz, and every lesson under a major before the major's
50-question paper. The previous shape ran three flat passes -- all majors, then
all middles, then all lessons -- so each category quiz was written before a
single lesson existed.

Order is a property of the wiring, not of any one node, which is why this walks
a compiled graph rather than calling nodes directly.
"""

from __future__ import annotations

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.graphs.certification import nodes
from app.graphs.certification.workflow import build_certification_graph


def _lesson(name: str) -> dict:
    return {"name": name, "learning_objective": "o", "key_topics": ["t"]}


def _curriculum(majors: int = 2, middles: int = 2, lessons: int = 2) -> dict:
    return {
        "majorCategories": [
            {
                "name": f"M{major}",
                "description": "d",
                "middleCategories": [
                    {
                        "name": f"M{major}.m{middle}",
                        "description": "d",
                        "lessons": [
                            _lesson(f"M{major}.m{middle}.L{lesson}") for lesson in range(lessons)
                        ],
                    }
                    for middle in range(middles)
                ],
            }
            for major in range(majors)
        ],
        "exam_structure": {"total_items": 0, "question_types": ["MCQ"], "notes": ""},
    }


def _covered(state, planned) -> int:
    """How many of `planned` have a generated body available as quiz context."""
    generated = nodes._generated_by_name(state)
    return sum(1 for lesson in (planned or []) if (lesson or {}).get("name") in generated)


@pytest.fixture
def trace(monkeypatch):
    """Records the order of generation steps, stubbing every LLM call."""
    steps: list[str] = []

    async def fake_lesson_content(state):
        lesson = nodes.current_item(state, nodes.LESSON_PHASE) or {}
        name = lesson.get("name")
        steps.append(f"lesson:{name}")
        curriculum = state.get("curriculum", {}) or {}
        index = nodes.current_index(state, nodes.LESSON_PHASE)
        major, middle = nodes._lesson_parents(curriculum, index)
        return {
            "lessons": [
                {
                    "name": name,
                    "majorCategory": major.get("name"),
                    "middleCategory": middle.get("name"),
                    "title": name,
                    "introduction": "i",
                    "sections": [{"type": "description", "data": {"text": f"body of {name}"}}],
                    "summary": "s",
                    "key_terms": [],
                    "blocks": [],
                }
            ]
        }

    async def fake_lesson_quiz(state):
        index = nodes.current_index(state, nodes.LESSON_PHASE)
        generated = state.get("lessons") or []
        name = generated[index]["name"] if index < len(generated) else "?"
        steps.append(f"lesson_quiz:{name}")
        return {"lesson_quizzes": [{"lesson": name, "questions": []}]}

    async def fake_middle(state):
        curriculum = state.get("curriculum", {}) or {}
        index = nodes.current_index(state, nodes.MIDDLE_PHASE)
        major, middle = nodes._middle_at(curriculum, index)
        # Records how many lessons the context was built from, so a quiz
        # written before its lessons exist is visible as [0].
        steps.append(f"middle_quiz:{middle.get('name')}[{_covered(state, middle.get('lessons'))}]")
        return {
            "middle_quizzes": [
                {
                    "majorCategory": major.get("name"),
                    "middleCategory": middle.get("name"),
                    "questions": [],
                }
            ]
        }

    async def fake_major(state):
        curriculum = state.get("curriculum", {}) or {}
        index = nodes.current_index(state, nodes.MAJOR_PHASE)
        major = nodes.current_item(state, nodes.MAJOR_PHASE) or {}
        planned = nodes._lessons_under_major(curriculum, index)
        steps.append(f"major_quiz:{major.get('name')}[{_covered(state, planned)}]")
        return {"major_quizzes": [{"majorCategory": major.get("name"), "questions": []}]}

    async def fake_mock(state):
        steps.append("mock")
        return {"mock_exam": {"questions": []}}

    async def fake_diagnostic(state):
        steps.append("diagnostic")
        return {"diagnostic_exam": {"questions": []}}

    async def fake_bank(state):
        steps.append("bank")
        return {"question_bank": []}

    import app.graphs.certification.workflow as wf

    monkeypatch.setattr(wf, "lesson_content_node", fake_lesson_content)
    monkeypatch.setattr(wf, "lesson_quiz_generate_node", fake_lesson_quiz)
    monkeypatch.setattr(wf, "middle_generate_node", fake_middle)
    monkeypatch.setattr(wf, "major_generate_node", fake_major)
    monkeypatch.setattr(wf, "generate_mock_exam_node", fake_mock)
    monkeypatch.setattr(wf, "generate_diagnostic_exam_node", fake_diagnostic)
    monkeypatch.setattr(wf, "generate_question_bank_node", fake_bank)
    # Validation and the LLM alignment audit are not what this test is about.
    monkeypatch.setattr(wf, "lesson_validate_node", lambda state: {})
    monkeypatch.setattr(wf, "middle_validate_node", lambda state: {})
    monkeypatch.setattr(wf, "major_validate_node", lambda state: {})
    return steps


def _run(curriculum: dict) -> None:
    """Drives the graph to the end, auto-approving every review.

    Async because the generation nodes are: LangGraph refuses a synchronous
    invoke on a graph whose nodes are coroutines.
    """
    import asyncio

    from langgraph.types import Command

    graph = build_certification_graph(InMemorySaver())
    config = {"configurable": {"thread_id": "order-test"}}

    async def drive():
        graph.update_state(
            config,
            {
                "certification_name": "TOPCIT",
                "certification_description": "d",
                "curriculum": curriculum,
                # Skips ingestion/planning: this test is about the order of
                # what comes after the curriculum is approved.
                "auto_approve_scopes": ["MAJOR", "MIDDLE", "LESSON"],
            },
            as_node="plan_curriculum",
        )
        result = await graph.ainvoke(None, config=config)
        # Every remaining pause is a certification-wide review (curriculum,
        # mock, diagnostic, bank); the per-item ones auto-approve above.
        for _ in range(20):
            if "__interrupt__" not in (result or {}):
                return
            result = await graph.ainvoke(Command(resume="approve"), config=config)
        raise AssertionError("graph did not settle -- the walk is looping")

    asyncio.run(drive())


def test_the_walk_is_bottom_up_and_interleaved(trace):
    _run(_curriculum(majors=2, middles=2, lessons=2))

    assert trace == [
        "lesson:M0.m0.L0", "lesson_quiz:M0.m0.L0",
        "lesson:M0.m0.L1", "lesson_quiz:M0.m0.L1",
        "middle_quiz:M0.m0[2]",
        "lesson:M0.m1.L0", "lesson_quiz:M0.m1.L0",
        "lesson:M0.m1.L1", "lesson_quiz:M0.m1.L1",
        "middle_quiz:M0.m1[2]",
        "major_quiz:M0[4]",
        "lesson:M1.m0.L0", "lesson_quiz:M1.m0.L0",
        "lesson:M1.m0.L1", "lesson_quiz:M1.m0.L1",
        "middle_quiz:M1.m0[2]",
        "lesson:M1.m1.L0", "lesson_quiz:M1.m1.L0",
        "lesson:M1.m1.L1", "lesson_quiz:M1.m1.L1",
        "middle_quiz:M1.m1[2]",
        "major_quiz:M1[4]",
        "mock",
        "diagnostic",
        "bank",
    ]


def test_a_middle_quiz_sees_only_its_own_lessons(trace):
    """Bracketed numbers are the lesson count its context was built from. A
    middle quiz drawing on 4 lessons would be testing a sibling category."""
    _run(_curriculum(majors=1, middles=2, lessons=3))

    middles = [step for step in trace if step.startswith("middle_quiz")]
    assert middles == ["middle_quiz:M0.m0[3]", "middle_quiz:M0.m1[3]"]


def test_a_major_quiz_sees_every_lesson_beneath_it(trace):
    _run(_curriculum(majors=2, middles=2, lessons=3))

    majors = [step for step in trace if step.startswith("major_quiz")]
    assert majors == ["major_quiz:M0[6]", "major_quiz:M1[6]"]


def test_the_single_lesson_test_configuration_still_walks_every_stage(trace):
    """The 1/1/1 configuration exists to exercise the whole workflow cheaply,
    so it must still produce every assessment -- not skip the category ones."""
    _run(_curriculum(majors=1, middles=1, lessons=1))

    assert trace == [
        "lesson:M0.m0.L0", "lesson_quiz:M0.m0.L0",
        "middle_quiz:M0.m0[1]",
        "major_quiz:M0[1]",
        "mock",
        "diagnostic",
        "bank",
    ]
