"""Media URLs are attached after generation, not during it.

The lesson agent held `search_educational_image` / `search_youtube_videos` and
was expected to call them and paste the result into the block it was writing.
Twelve live attempts produced the same failure: correct blocks up to the media
key, then the call inlined as the value::

    {"type": "image", "data": {"imageKey": "<function=search_educational_image{...

which Groq rejects with `tool_use_failed`. Same shape as the eighteen
lesson-builder tools removed before it, one layer down. The model now writes a
plain `imageQuery` string and the search runs here.
"""

from __future__ import annotations

import pytest

from app.domain import lesson_media
from app.domain.lesson_media import resolve_media


@pytest.fixture()
def searches(monkeypatch):
    """Records every lookup instead of hitting the network."""
    calls = {"image": [], "video": []}

    def image(query, num=1):
        calls["image"].append(query)
        return [{"imageUrl": f"https://img.example/{len(calls['image'])}.png"}]

    def video(query, max_results=1):
        calls["video"].append(query)
        return [{"id": {"videoId": "abc123"}}]

    monkeypatch.setattr(lesson_media, "serper_image_search", image)
    monkeypatch.setattr(lesson_media, "youtube_search", video)
    return calls


def _image_block(query="requirement management diagram"):
    return {"type": "image", "data": {"imageQuery": query}}


# --- resolution -----------------------------------------------------------

def test_an_image_request_becomes_a_real_url(searches):
    block = resolve_media([_image_block()])[0]

    assert block["data"]["imageKey"] == "https://img.example/1.png"
    assert searches["image"] == ["requirement management diagram diagram architecture chart"]


def test_the_request_key_does_not_survive_into_the_stored_block():
    """`imageQuery` is a message to this module, not something the renderer
    should ever see."""
    block = resolve_media([_image_block()])[0]
    assert "imageQuery" not in block["data"]


def test_a_video_request_becomes_a_watch_url(searches):
    block = resolve_media([{"type": "video", "data": {"videoQuery": "requirements tutorial"}}])[0]
    assert block["data"]["videoKey"] == "https://www.youtube.com/watch?v=abc123"


def test_resolved_blocks_get_the_file_slot_the_renderer_reads(searches):
    assert resolve_media([_image_block()])[0]["data"]["file"] is None


def test_a_block_carrying_both_kinds_resolves_both(searches):
    block = resolve_media(
        [{"type": "media-text-block",
          "data": {"imageQuery": "erd", "videoQuery": "erd walkthrough", "layout": "image-left"}}]
    )[0]

    assert block["data"]["imageKey"].startswith("https://img.example/")
    assert block["data"]["videoKey"].startswith("https://www.youtube.com/")
    assert block["data"]["layout"] == "image-left", "other fields must be untouched"


def test_the_same_request_is_searched_once_per_lesson(searches):
    """Three blocks wanting the same diagram is one API call, not three."""
    resolve_media([_image_block("normalization"), _image_block("normalization"),
                   _image_block("normalization")])

    assert len(searches["image"]) == 1


# --- never lose the lesson over a picture ---------------------------------

def test_a_failed_search_leaves_the_key_blank_rather_than_raising(monkeypatch):
    def boom(query, num=1):
        raise RuntimeError("SERPER_API_KEY missing")

    monkeypatch.setattr(lesson_media, "serper_image_search", boom)

    block = resolve_media([_image_block()])[0]
    assert block["data"]["imageKey"] == ""


def test_an_empty_result_is_not_filled_with_an_invented_url(monkeypatch):
    monkeypatch.setattr(lesson_media, "serper_image_search", lambda query, num=1: [])
    assert resolve_media([_image_block()])[0]["data"]["imageKey"] == ""


def test_a_failure_does_not_stop_later_blocks_resolving(monkeypatch):
    seen = []

    def flaky(query, num=1):
        seen.append(query)
        if len(seen) == 1:
            raise RuntimeError("transient")
        return [{"imageUrl": "https://img.example/ok.png"}]

    monkeypatch.setattr(lesson_media, "serper_image_search", flaky)

    blocks = resolve_media([_image_block("first"), _image_block("second")])
    assert blocks[0]["data"]["imageKey"] == ""
    assert blocks[1]["data"]["imageKey"] == "https://img.example/ok.png"


# --- everything else passes through --------------------------------------

def test_blocks_without_media_are_returned_unchanged(searches):
    heading = {"type": "heading", "data": {"text": "Overview"}}
    assert resolve_media([heading]) == [heading]
    assert searches["image"] == []


def test_a_blank_query_is_not_searched(searches):
    block = resolve_media([{"type": "image", "data": {"imageQuery": "   "}}])[0]
    assert searches["image"] == []
    assert "imageQuery" in block["data"] or block["data"].get("imageKey", "") == ""


def test_malformed_blocks_are_left_for_the_schema_to_judge(searches):
    assert resolve_media([{"type": "heading"}, "not a block"]) == [{"type": "heading"}, "not a block"]


# --- the prompt must not ask for what it cannot produce -------------------

def test_the_prompt_never_asks_the_model_for_a_media_url():
    """The regression guard: reintroducing `imageKey` to the block catalogue
    would invite the inlined tool call straight back."""
    from app.agents.certification.lesson_agent import build_system_prompt

    SYSTEM_PROMPT = build_system_prompt()

    catalogue = SYSTEM_PROMPT[SYSTEM_PROMPT.index("CONTENT BLOCKS"):]
    assert "imageKey" not in catalogue
    assert "videoKey" not in catalogue
    assert "imageQuery" in catalogue


def test_the_agent_is_given_no_tool_whose_result_belongs_in_the_answer():
    from app.tools.certification.lesson_tools import lesson_research_tools

    assert [tool.name for tool in lesson_research_tools] == ["search_more_lesson_info"]
