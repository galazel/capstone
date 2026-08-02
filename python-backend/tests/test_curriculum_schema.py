"""Curriculum schema tolerance tests.

Four live TOPCIT runs died with HTTP 400 `tool_use_failed`:

    missing properties: 'status'
    .../lessonGenerationInstructions/certification_focus:
        expected array, but got string
    ...a second major category nested inside the first's middleCategories
    ...and finally unbalanced JSON, mid-array, with no schema error at all

Groq parses and validates tool-call arguments before returning them, so none
of these could be fixed by a pydantic validator -- the provider rejected the
payload first. The first three were answered by making the schema tolerant.
The fourth could not be: it was the sheer size of a 12-field
`lessonGenerationInstructions` object repeated per lesson across a whole
syllabus. The planner now emits an outline instead, and these tests pin both
the emitted schema and the local repair.
"""

from __future__ import annotations

import json

import pytest
from langchain_core.utils.function_calling import convert_to_openai_tool

from app.schemas.certification.curriculum_schema import Curriculum, Lesson


def _tool_schema() -> dict:
    return convert_to_openai_tool(Curriculum)["function"]["parameters"]


def _lesson_schema() -> dict:
    """Walks to a lesson in the tool schema.

    The tool schema is fully inlined -- no `$defs` -- so the nesting has to be
    traversed, which doubles as a check that the hierarchy Groq validates
    against is the one the prompt describes.
    """
    schema = _tool_schema()["properties"]["majorCategories"]["items"]
    schema = schema["properties"]["middleCategories"]["items"]
    return schema["properties"]["lessons"]["items"]


# --- the outline contract ---------------------------------------------------


def test_the_curriculum_is_the_tool_schema_root():
    """The `certification_name`/`curriculum`/`status` wrapper is gone. It cost
    two levels of nesting and gave the model a `status` field it misplaced in
    three of four samples, for data the graph already tracks itself.

    `exam_structure` earns its place where those did not: it is one flat
    object for the whole curriculum, and the mock exam cannot imitate a real
    paper without it."""
    assert set(_tool_schema()["properties"]) == {"majorCategories", "exam_structure"}


def test_the_exam_structure_is_planned_once_not_per_lesson():
    """Per-lesson payload growth is what made the planner's tool call fail in
    the first place; this must never become a per-lesson field."""
    assert "exam_structure" not in _lesson_schema()["properties"]
    structure = _tool_schema()["properties"]["exam_structure"]
    assert set(structure["properties"]) == {"total_items", "question_types", "notes"}
    assert structure.get("required", []) == []


def test_a_lesson_carries_only_an_outline():
    """The whole point of the change: what the planner emits per lesson is
    small enough that a full syllabus fits in one tool call."""
    assert set(_lesson_schema()["properties"]) == {
        "name",
        "learning_objective",
        "key_topics",
    }


def test_only_the_lesson_name_is_required():
    assert _lesson_schema()["required"] == ["name"]


def test_key_topics_accepts_a_string_in_the_provider_schema():
    """The rejection happened server-side, so it is the *schema* -- not the
    pydantic coercion below -- that has to tolerate a bare string."""
    prop = _lesson_schema()["properties"]["key_topics"]
    assert {branch.get("type") for branch in prop["anyOf"]} == {"array", "string"}


def test_a_bare_string_is_coerced_to_a_single_element_list():
    assert Lesson(name="n", key_topics="Requirements").key_topics == ["Requirements"]


@pytest.mark.parametrize("value", [None, "", "   "])
def test_empty_values_become_an_empty_list_rather_than_a_validation_error(value):
    assert Lesson(name="n", key_topics=value).key_topics == []


def test_a_list_still_validates_unchanged():
    assert Lesson(name="n", key_topics=["a", "b"]).key_topics == ["a", "b"]


def test_non_string_scalars_are_still_rejected():
    with pytest.raises(ValueError):
        Lesson(name="n", key_topics=42)


# --- Mis-nested categories --------------------------------------------------
#
# A live TOPCIT run failed all five attempts with the same `tool_use_failed`
# 400: every sample put the second *major* category inside the first one's
# `middleCategories` array, so that entry had `middleCategories` where the
# schema required `lessons`.


def _lesson(name: str) -> dict:
    return {"name": name, "learning_objective": "o", "key_topics": ["t1", "t2"]}


def _middle(name: str, lessons: int = 3) -> dict:
    """Three lessons by default so fixtures clear `MIN_TOTAL_LESSONS`. The
    breadth floor is a real product rule, not something tests should dodge."""
    return {
        "name": name,
        "description": "d",
        "lessons": [_lesson(f"{name} lesson {i}") for i in range(lessons)],
    }


def _major(name: str, *middles: dict) -> dict:
    return {"name": name, "description": "d", "middleCategories": list(middles)}


def _misnested() -> dict:
    """The live payload's shape: two majors, the second buried in the first."""
    return {
        "majorCategories": [
            _major(
                "Software Development",
                _middle("Requirement Management"),
                _major("Database Construction and Management", _middle("Data Modeling")),
            )
        ]
    }


def test_lessons_is_not_required_by_the_provider_schema():
    """What produced the 400: the mis-nested branch has no `lessons`, so a
    required `lessons` meant the provider rejected the call before any local
    repair could run."""
    middle = _tool_schema()["properties"]["majorCategories"]["items"]["properties"][
        "middleCategories"
    ]["items"]
    assert "lessons" not in middle["required"]


def test_a_misnested_major_category_is_hoisted_to_the_top_level(shipped_defaults):
    curriculum = Curriculum(**_misnested())
    assert [major.name for major in curriculum.majorCategories] == [
        "Software Development",
        "Database Construction and Management",
    ]


def test_hoisting_leaves_the_real_middle_categories_in_place(shipped_defaults):
    majors = Curriculum(**_misnested()).majorCategories
    assert [middle.name for middle in majors[0].middleCategories] == ["Requirement Management"]
    assert [middle.name for middle in majors[1].middleCategories] == ["Data Modeling"]


def test_hoisting_recurses_through_repeated_misnesting(shipped_defaults):
    payload = {
        "majorCategories": [
            _major(
                "A",
                _middle("a1"),
                _major("B", _middle("b1"), _major("C", _middle("c1"))),
            )
        ]
    }
    assert [major.name for major in Curriculum(**payload).majorCategories] == ["A", "B", "C"]


def test_a_middle_category_misnested_among_lessons_is_hoisted_out(shipped_defaults):
    """One level down from the above, and the reason a lesson is now identified
    by what it does *not* carry: without `lessonGenerationInstructions` to look
    for, a node with its own `lessons` is the only remaining tell."""
    middle = _middle("Real")
    middle["lessons"].append(_middle("Buried"))
    payload = {"majorCategories": [_major("A", middle), _major("B", _middle("b1"))]}

    majors = Curriculum(**payload).majorCategories
    assert [m.name for m in majors[0].middleCategories] == ["Real", "Buried"]
    assert [lesson.name for lesson in majors[0].middleCategories[0].lessons] == [
        "Real lesson 0",
        "Real lesson 1",
        "Real lesson 2",
    ], "the buried category must not survive as a lesson too"


def test_a_major_left_with_no_lessons_is_dropped_rather_than_kept_empty(shipped_defaults):
    payload = {
        "majorCategories": [
            _major("Shell", _major("Real", _middle("m1"))),
            _major("Other", _middle("m2")),
        ]
    }
    assert [major.name for major in Curriculum(**payload).majorCategories] == [
        "Real",
        "Other",
    ], "the empty shell contributes nothing and is dropped"


def test_a_wellformed_curriculum_is_left_untouched(shipped_defaults):
    payload = {"majorCategories": [_major("A", _middle("a1")), _major("B", _middle("b1"))]}
    majors = Curriculum(**payload).majorCategories
    assert [major.name for major in majors] == ["A", "B"]
    assert [middle.name for middle in majors[0].middleCategories] == ["a1"]


def test_a_curriculum_with_no_lessons_anywhere_is_rejected_for_resampling(shipped_defaults):
    with pytest.raises(ValueError):
        Curriculum(majorCategories=[_major("A"), _major("B")])


def test_an_explicitly_empty_curriculum_is_still_allowed():
    """`majorCategories: []` is the graph's own empty value, not a bad sample."""
    assert Curriculum(majorCategories=[]).majorCategories == []


# --- the misplaced exam structure ------------------------------------------
#
# `exam_structure` is the last thing the prompt asks for and the last thing
# the model writes, so it lands inside whichever major category it happened to
# be finishing. Live payload: three majors, the whole exam structure sitting in
# the third. Left there it is dropped as an unknown field and the mock exam
# falls back to a generic MCQ paper -- the one fact that makes it imitate the
# real exam, lost silently.


def _structure() -> dict:
    return {"total_items": 100, "question_types": ["MCQ", "DIAGRAM"], "notes": "3 hours"}


def test_an_exam_structure_written_inside_a_major_is_hoisted_to_the_root(shipped_defaults):
    payload = {
        "majorCategories": [
            _major("A", _middle("a1")),
            {**_major("B", _middle("b1")), "exam_structure": _structure()},
        ]
    }
    curriculum = Curriculum(**payload)
    assert curriculum.exam_structure.total_items == 100
    assert curriculum.exam_structure.question_types == ["MCQ", "DIAGRAM"]
    assert [major.name for major in curriculum.majorCategories] == ["A", "B"]


def test_a_correctly_placed_exam_structure_wins_over_a_stray_one(shipped_defaults):
    payload = {
        "majorCategories": [
            {**_major("A", _middle("a1")), "exam_structure": {"total_items": 7}},
            _major("B", _middle("b1")),
        ],
        "exam_structure": _structure(),
    }
    assert Curriculum(**payload).exam_structure.total_items == 100


# --- breadth ---------------------------------------------------------------
#
# A live TOPCIT run produced one major category, two middles and two lessons
# for a whole certification. Structurally valid, useless as a syllabus, and it
# persisted happily -- the certification then showed two lessons and nothing
# else. The prompt now asks for 3-6 majors with 3-5 lessons each; these are the
# numbers below which the sample is rejected and resampled.


def test_a_token_curriculum_is_rejected_so_it_gets_resampled(shipped_defaults):
    """The exact shape of the live failure: one major, two lessons."""
    payload = {
        "majorCategories": [_major("Only", _middle("m1", lessons=1), _middle("m2", lessons=1))]
    }
    with pytest.raises(ValueError, match="too small to be a syllabus"):
        Curriculum(**payload)


def test_enough_lessons_but_only_one_major_is_still_rejected(shipped_defaults):
    """Breadth is two-dimensional -- one category is not a certification."""
    with pytest.raises(ValueError, match="too small"):
        Curriculum(majorCategories=[_major("Only", _middle("m1", lessons=9))])


def test_enough_majors_but_too_few_lessons_is_still_rejected(shipped_defaults):
    payload = {
        "majorCategories": [
            _major("A", _middle("a1", lessons=1)),
            _major("B", _middle("b1", lessons=1)),
        ]
    }
    with pytest.raises(ValueError, match="too small"):
        Curriculum(**payload)


def test_a_modest_but_real_curriculum_passes(shipped_defaults):
    """The floor sits well under what the prompt asks for, so a merely
    modest curriculum is accepted rather than resampled forever."""
    payload = {
        "majorCategories": [
            _major("A", _middle("a1", lessons=3)),
            _major("B", _middle("b1", lessons=3)),
        ]
    }
    assert len(Curriculum(**payload).majorCategories) == 2


def test_the_breadth_floor_is_not_imposed_on_the_provider_schema():
    """`minItems` in the tool schema would turn an under-sized sample into a
    `tool_use_failed` 400 -- unretryable in any useful way and illegible in the
    log. The floor has to be a local ValueError so it resamples."""
    assert "minItems" not in json.dumps(_tool_schema())


def test_the_prompt_asks_for_more_than_the_floor_requires(shipped_defaults):
    """If the prompt asked for exactly the minimum, every slightly-short
    sample would fail. It should aim high and the floor should catch disasters."""
    from app.agents.certification.curriculum_agent import build_system_prompt

    prompt = build_system_prompt()
    assert "3 to 6 Major Categories" in prompt
    assert "3 to 5 Lessons" in prompt


def test_the_prompt_no_longer_asks_for_a_per_lesson_instruction_object():
    """The regression this whole change exists to prevent: reintroducing a
    large per-lesson payload puts the request back over what the model can
    emit in one tool call."""
    from app.agents.certification.curriculum_agent import build_system_prompt

    prompt = build_system_prompt()
    assert "lessonGenerationInstructions" not in prompt
    assert "key_topics" in prompt


# --- configurable size ------------------------------------------------------
#
# The whole workflow has to be runnable on a small AI budget: one major, one
# middle, one lesson, with the review checkpoints and assessments still in
# place. That means the breadth floor cannot be a constant, or a deliberately
# minimal run is rejected as a bad sample and resampled until the quota is gone.


_SIZE_FIELDS = (
    "curriculum_min_majors",
    "curriculum_max_majors",
    "curriculum_min_middles",
    "curriculum_max_middles",
    "curriculum_min_lessons",
    "curriculum_max_lessons",
)


@pytest.fixture
def shipped_defaults(monkeypatch):
    """Pins the shipped curriculum size for one test.

    Without this, a checkout whose .env carries the deliberately tiny test
    configuration (one major, one middle, one lesson -- the whole point of
    making the size configurable) would fail every assertion about the
    default ask and the floor derived from it. Tests must describe the code,
    not the machine they run on.
    """
    from app.core.config import Settings, get_settings

    get_settings.cache_clear()
    for name in _SIZE_FIELDS:
        monkeypatch.setenv(name.upper(), str(Settings.model_fields[name].default))
    yield
    get_settings.cache_clear()


@pytest.fixture
def tiny_curriculum_settings(monkeypatch):
    from app.core.config import Settings, get_settings

    get_settings.cache_clear()
    for field in ("majors", "middles", "lessons"):
        monkeypatch.setenv(f"CURRICULUM_MIN_{field.upper()}", "1")
        monkeypatch.setenv(f"CURRICULUM_MAX_{field.upper()}", "1")
    yield Settings()
    get_settings.cache_clear()


def test_the_breadth_floor_follows_the_configured_ask(tiny_curriculum_settings):
    from app.schemas.certification.curriculum_schema import (
        required_major_categories,
        required_total_lessons,
    )

    assert required_major_categories() == 1
    assert required_total_lessons() == 1


def test_a_single_lesson_curriculum_is_accepted_when_that_is_what_was_asked_for(
    tiny_curriculum_settings,
):
    payload = {"majorCategories": [_major("Only", _middle("m1", lessons=1))]}
    majors = Curriculum(**payload).majorCategories
    assert [major.name for major in majors] == ["Only"]
    assert len(majors[0].middleCategories[0].lessons) == 1


def test_the_default_floor_is_unchanged_by_making_it_derived(shipped_defaults):
    """The derivation exists to scale down, not to move the shipped floor."""
    from app.schemas.certification.curriculum_schema import (
        required_major_categories,
        required_total_lessons,
    )

    assert (required_major_categories(), required_total_lessons()) == (2, 6)


def test_an_exact_ask_drops_the_contradictory_breadth_push(tiny_curriculum_settings):
    """Telling the model a syllabus has dozens of lessons and then asking for
    one is a contradiction it resolves by ignoring one of the two."""
    from app.agents.certification.curriculum_agent import _size_section

    section = _size_section(tiny_curriculum_settings)
    assert "Exactly 1 Major Category" in section
    assert "dozens of lessons" not in section


def test_a_max_below_its_min_is_rejected_rather_than_silently_asked_for(monkeypatch):
    from app.core.config import Settings

    monkeypatch.setenv("CURRICULUM_MIN_MAJORS", "4")
    monkeypatch.setenv("CURRICULUM_MAX_MAJORS", "2")
    with pytest.raises(ValueError, match="curriculum_max_majors"):
        Settings()


def test_lesson_depth_is_independent_of_curriculum_size(tiny_curriculum_settings):
    """A cheap test run wants few lessons, not thin ones -- shrinking the
    syllabus must not shrink the lesson."""
    from app.agents.certification.lesson_agent import build_system_prompt

    assert f"least {tiny_curriculum_settings.lesson_min_sections} of them" in (
        build_system_prompt()
    )
