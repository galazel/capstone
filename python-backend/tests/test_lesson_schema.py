"""Typed lesson anatomy: schema enforcement, block rendering, quality report.

Q2 specified that every lesson carries a fixed anatomy (introduction,
objectives, estimated study time, content, key terms, summary) while
categories stay organizational. Previously the lesson agent returned
`sections: List[dict]` -- an untyped blob -- so a lesson missing its summary
passed through silently.
"""

from __future__ import annotations

import pytest

from app.domain.lesson_blocks import lesson_to_blocks
from app.domain.validation import validate_lesson, validate_lessons
from app.schemas.certification.lesson_schema import GeneratedLesson, KeyTerm


def _blocks(n: int = 4) -> list[dict]:
    return [
        {"type": "description", "data": {"text": "Substantial paragraph of teaching content. " * 6}}
        for _ in range(n)
    ]


def _lesson(**overrides) -> GeneratedLesson:
    base = dict(
        title="Database Indexing",
        introduction="In this lesson you will learn how indexes speed up lookups and what they cost.",
        learning_objectives=["Explain B-tree indexes", "Choose an index for a query"],
        estimated_minutes=25,
        sections=_blocks(),
        key_terms=[KeyTerm(term="Index", definition="A structure that speeds lookups.")],
        summary="Indexes trade write cost and storage for much faster reads on selective queries.",
    )
    base.update(overrides)
    return GeneratedLesson(**base)


# --- schema enforcement (raises -> retry policy regenerates) --------------

def test_valid_lesson_is_accepted():
    assert _lesson().title == "Database Indexing"


def test_missing_introduction_is_rejected():
    with pytest.raises(ValueError, match="introduction"):
        _lesson(introduction="too short")


def test_missing_objectives_is_rejected():
    with pytest.raises(ValueError, match="learning objective"):
        _lesson(learning_objectives=[])


def test_blank_objective_is_rejected():
    with pytest.raises(ValueError, match="must not be blank"):
        _lesson(learning_objectives=["Explain indexes", "   "])


def test_missing_summary_is_rejected():
    with pytest.raises(ValueError, match="summary"):
        _lesson(summary="short")


def test_empty_content_is_rejected():
    with pytest.raises(ValueError, match="instructional content"):
        _lesson(sections=[])


def test_nonpositive_study_time_is_rejected():
    with pytest.raises(ValueError, match="estimated_minutes"):
        _lesson(estimated_minutes=0)


# --- block rendering ------------------------------------------------------

def test_blocks_render_the_full_anatomy_in_reading_order():
    blocks = lesson_to_blocks(_lesson())
    headings = [b["data"]["text"] for b in blocks if b["type"] == "heading"]

    assert headings[0] == "Database Indexing"
    assert "Introduction" in headings
    assert "Learning Objectives" in headings
    assert "Key Terms" in headings
    assert "Summary" in headings
    # Summary closes the lesson.
    assert headings.index("Summary") > headings.index("Introduction")


def test_blocks_use_only_types_the_frontend_already_renders():
    """The typed schema must not require any frontend change."""
    known = {"heading", "description", "unordered-list", "accordion"}
    blocks = lesson_to_blocks(_lesson())
    assert {b["type"] for b in blocks} <= known


def test_objectives_render_as_a_bullet_list():
    blocks = lesson_to_blocks(_lesson())
    lists = [b for b in blocks if b["type"] == "unordered-list"]
    assert lists
    texts = [i["text"] for i in lists[0]["data"]["items"]]
    assert "Explain B-tree indexes" in texts


def test_estimated_time_is_surfaced_to_the_learner():
    blocks = lesson_to_blocks(_lesson(estimated_minutes=25))
    assert any("25 minutes" in b.get("data", {}).get("text", "") for b in blocks)


def test_main_content_blocks_are_passed_through_untouched():
    marker = {"type": "flip-grid", "data": {"cards": [{"id": "x", "frontTitle": "Q"}]}}
    blocks = lesson_to_blocks(_lesson(sections=[*_blocks(2), marker]))
    assert marker in blocks


def test_rendering_accepts_a_plain_dict():
    """Nodes pass lessons around as dicts once they're in graph state."""
    blocks = lesson_to_blocks(_lesson().model_dump())
    assert any(b["type"] == "heading" for b in blocks)


# --- advisory quality report ---------------------------------------------

def test_healthy_lesson_scores_well():
    report = validate_lesson(_lesson())
    assert report.passed
    assert report.score >= 90, [i.code for i in report.issues]


def test_thin_content_is_an_error():
    report = validate_lesson(_lesson(sections=_blocks(1)))
    assert not report.passed
    assert any(i.code == "THIN_CONTENT" for i in report.errors)


def test_shallow_content_is_warned():
    tiny = [{"type": "description", "data": {"text": "short"}} for _ in range(4)]
    report = validate_lesson(_lesson(sections=tiny))
    assert any(i.code == "SHALLOW_CONTENT" for i in report.warnings)


def test_missing_key_terms_is_warned():
    report = validate_lesson(_lesson(key_terms=[]))
    assert any(i.code == "NO_KEY_TERMS" for i in report.warnings)


def test_implausible_study_time_is_warned():
    report = validate_lesson(_lesson(estimated_minutes=600))
    assert any(i.code == "IMPLAUSIBLE_STUDY_TIME" for i in report.warnings)


def test_too_many_objectives_suggests_a_misscoped_lesson():
    report = validate_lesson(_lesson(learning_objectives=[f"Objective {i}" for i in range(12)]))
    assert any(i.code == "TOO_MANY_OBJECTIVES" for i in report.warnings)


def test_missing_visuals_only_warns_when_expected():
    lesson = _lesson()
    assert not any(i.code == "NO_VISUALS" for i in validate_lesson(lesson).issues)
    assert any(i.code == "NO_VISUALS" for i in validate_lesson(lesson, expect_visuals=True).issues)


def test_visual_blocks_satisfy_the_visual_expectation():
    lesson = _lesson(sections=[*_blocks(3), {"type": "image", "data": {"imageKey": "k"}}])
    assert not any(i.code == "NO_VISUALS" for i in validate_lesson(lesson, expect_visuals=True).issues)


def test_aggregate_report_tags_issues_with_their_lesson_index():
    good = _lesson()
    thin = _lesson(sections=_blocks(1))
    report = validate_lessons([good, thin])

    assert not report.passed
    thin_issues = [i for i in report.errors if i.code == "THIN_CONTENT"]
    assert thin_issues and thin_issues[0].question_indices == [1]


def test_aggregate_report_on_no_lessons_is_an_error():
    report = validate_lessons([])
    assert not report.passed
    assert report.score == 0
    assert report.issues[0].code == "NO_LESSONS"
