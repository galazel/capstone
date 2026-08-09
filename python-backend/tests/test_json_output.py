"""The planner's answer is read as JSON here, not validated by the provider.

A fifth live TOPCIT-style run died with HTTP 400 `tool_use_failed`, and this
time the payload was neither too big nor schema-invalid. It was *complete
except for its last two characters*: the model wrote `exam_structure` inside
its third major category, closed that, and stopped -- never emitting the `]`
that closes `majorCategories` or the `}` that closes the object. Five samples
in a row ended that way and the run failed, because Groq validates tool-call
arguments server-side and threw each one away before this process saw it.

So the curriculum agent no longer declares a structured-output tool. It answers
in plain JSON, and `app.ai.json_output` closes what the model left open. These
tests pin that repair, and pin the line past which a sample is resampled rather
than guessed at.
"""

from __future__ import annotations

import json

import pytest

from app.ai.json_output import extract_json_object, final_message_text


class _Message:
    def __init__(self, content):
        self.content = content


def _response(*contents):
    return {"messages": [_Message(content) for content in contents]}


# --- reading the answer out of the run --------------------------------------


def test_the_answer_is_the_last_message_of_the_run():
    """An agent with search tools produces several messages; only the final
    one is the answer."""
    response = _response("searching...", '{"a": 1}')
    assert extract_json_object(final_message_text(response)) == {"a": 1}


def test_block_style_content_is_flattened():
    """Content arrives as a string from Groq and as blocks from others. The
    parser must not depend on which."""
    response = _response([{"type": "text", "text": '{"a"'}, {"type": "text", "text": ': 1}'}])
    assert extract_json_object(final_message_text(response)) == {"a": 1}


@pytest.mark.parametrize("response", [{"messages": []}, {}, _response("   ")])
def test_an_empty_run_is_a_valueerror_so_it_gets_resampled(response):
    """ValueError is what `app.ai.retry` classifies as malformed output. A
    model that answered with nothing is resampled, not fatal."""
    with pytest.raises(ValueError):
        final_message_text(response)


# --- prose and fences around the object -------------------------------------


def test_a_preamble_before_the_object_is_ignored():
    text = "Here is the curriculum you asked for:\n\n{\"majorCategories\": []}"
    assert extract_json_object(text) == {"majorCategories": []}


def test_a_fenced_object_is_read_out_of_the_fence():
    assert extract_json_object('```json\n{"a": 1}\n```') == {"a": 1}


def test_trailing_commentary_after_the_object_is_ignored():
    assert extract_json_object('{"a": 1}\n\nLet me know if you want more detail.') == {"a": 1}


# --- the live failure -------------------------------------------------------


def _truncated() -> str:
    """The shape of the live payload: complete but for its final `]}`."""
    return json.dumps(
        {
            "majorCategories": [
                {"name": "A", "middleCategories": [{"name": "a1", "lessons": []}]},
                {"name": "B", "exam_structure": {"total_items": 100}},
            ]
        }
    )[:-2]


def test_a_payload_missing_its_closing_brackets_is_closed_not_discarded():
    value = extract_json_object(_truncated())
    assert [major["name"] for major in value["majorCategories"]] == ["A", "B"]
    assert value["majorCategories"][1]["exam_structure"] == {"total_items": 100}


def test_a_cut_inside_a_string_falls_back_to_the_last_complete_container():
    """Appending brackets cannot rescue a half-written string, so the parser
    winds back to the last container that closed cleanly. One partly-written
    lesson is lost; the syllabus is not."""
    text = '{"majorCategories": [{"name": "A"}, {"name": "B", "descripti'
    assert extract_json_object(text) == {"majorCategories": [{"name": "A"}]}


def test_a_trailing_comma_left_by_the_cut_is_not_left_behind():
    text = '{"majorCategories": [{"name": "A"}, '
    assert extract_json_object(text) == {"majorCategories": [{"name": "A"}]}


def test_a_brace_inside_a_string_does_not_count_as_structure():
    assert extract_json_object('{"notes": "use {} for an empty set"}') == {
        "notes": "use {} for an empty set"
    }


def test_an_escaped_quote_does_not_end_the_string():
    assert extract_json_object(r'{"notes": "say \"hello\"", "n": 1}') == {
        "notes": 'say "hello"',
        "n": 1,
    }


# --- what is not guessed at --------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "I could not find enough information about this certification.",
        "{",
        '{"majorCategories": [',
        '{"majorCategories": ]}',
    ],
    ids=["prose", "bare-brace", "nothing-closed", "mismatched"],
)
def test_output_with_nothing_recoverable_is_a_valueerror(text):
    with pytest.raises(ValueError):
        extract_json_object(text)


def test_a_truncated_curriculum_survives_the_whole_invocation_path(monkeypatch):
    """End to end over the real adapter: the answer the provider rejected five
    times becomes a validated `Curriculum`, with the stray `exam_structure`
    hoisted back to the root on the way."""
    from app.ai.invocation import json_output
    from app.schemas.certification.curriculum_schema import Curriculum

    # Both ends of each range are pinned. Setting only the minimums left the
    # maximums coming from whatever `.env` happened to hold, so this test
    # passed or failed on ambient config: a .env narrowed for a cheap test run
    # (max 1) makes min 3 > max 1 and the Settings validator rejects it before
    # the sample under test is ever parsed.
    monkeypatch.setenv("CURRICULUM_MIN_MAJORS", "3")
    monkeypatch.setenv("CURRICULUM_MAX_MAJORS", "6")
    monkeypatch.setenv("CURRICULUM_MIN_MIDDLES", "2")
    monkeypatch.setenv("CURRICULUM_MAX_MIDDLES", "5")
    monkeypatch.setenv("CURRICULUM_MIN_LESSONS", "3")
    monkeypatch.setenv("CURRICULUM_MAX_LESSONS", "6")
    from app.core.config import get_settings

    get_settings.cache_clear()

    def _lesson(name):
        return {"name": name, "learning_objective": "o", "key_topics": ["t"]}

    def _major(name):
        return {
            "name": name,
            "description": "d",
            "middleCategories": [
                {
                    "name": f"{name}-{m}",
                    "description": "d",
                    "lessons": [_lesson(f"{name}-{m}-{i}") for i in range(3)],
                }
                for m in range(2)
            ],
        }

    majors = [_major("A"), _major("B"), _major("C")]
    majors[-1]["exam_structure"] = {"total_items": 100, "question_types": ["MCQ", "DIAGRAM"]}
    # `[:-2]` reproduces the live cut exactly: everything written, `]}` missing.
    answer = json.dumps({"majorCategories": majors})[:-2]

    class _Agent:
        async def ainvoke(self, payload, config=None):
            return _response("Let me search for the exam objectives.", answer)

    import asyncio

    agent = json_output(lambda model=None: _Agent(), Curriculum)()
    curriculum = asyncio.run(agent.ainvoke({"messages": []}))

    try:
        assert [major.name for major in curriculum.majorCategories] == ["A", "B", "C"]
        assert curriculum.exam_structure.total_items == 100
        assert curriculum.exam_structure.question_types == ["MCQ", "DIAGRAM"]
    finally:
        get_settings.cache_clear()


def test_a_bare_array_answer_yields_its_first_object_for_the_schema_to_judge():
    """Scanning from the first `{` is what lets a preamble through, and the
    cost is that a top-level array is read as its first element rather than
    rejected outright. Left to the schema: `Curriculum` requires
    `majorCategories`, so this is a `ValidationError` -- a ValueError, hence
    resampled -- one step later, with a message that names the missing field
    instead of a generic parse complaint."""
    assert extract_json_object('[{"name": "A"}]') == {"name": "A"}
