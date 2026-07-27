"""Renders a typed lesson into the display blocks the frontend already knows.

`lessons.lesson_component_structure` is a jsonb list of blocks shaped exactly
like the lesson-builder tools' output (`{"type": ..., "data": {...}}`). The
lesson editor and learner view already render those, so the typed anatomy is
converted into the same vocabulary rather than inventing a new one -- that
keeps the schema change invisible to the frontend.

Pure functions: no I/O, no framework.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4


def _id() -> str:
    return str(uuid4())


def heading(text: str) -> dict[str, Any]:
    return {"type": "heading", "data": {"text": text}}


def description(text: str) -> dict[str, Any]:
    return {"type": "description", "data": {"text": text}}


def bullet_list(items: list[str]) -> dict[str, Any]:
    return {
        "type": "unordered-list",
        "data": {"items": [{"id": _id(), "text": item} for item in items]},
    }


def key_terms_accordion(terms: list[dict[str, Any]]) -> dict[str, Any]:
    """Key terms as an accordion -- collapsible, so a long glossary doesn't
    bury the summary beneath it."""
    return {
        "type": "accordion",
        "data": {
            "items": [
                {"id": _id(), "title": t.get("term", ""), "description": t.get("definition", "")}
                for t in terms
            ]
        },
    }


def _as_dicts(values: list[Any]) -> list[dict[str, Any]]:
    """Accepts pydantic models or plain dicts."""
    return [v if isinstance(v, dict) else v.model_dump() for v in values]


def lesson_to_blocks(lesson: Any) -> list[dict[str, Any]]:
    """Assembles the full lesson in the order a learner reads it.

    Deterministic: the same lesson always produces the same block sequence,
    so every lesson in the platform has an identical shape -- the
    consistency the Cisco-style structure calls for.
    """
    get = lesson.get if isinstance(lesson, dict) else (lambda k, d=None: getattr(lesson, k, d))

    blocks: list[dict[str, Any]] = []

    blocks.append(heading(get("title", "") or "Lesson"))

    introduction = get("introduction", "") or ""
    if introduction:
        blocks.append(heading("Introduction"))
        blocks.append(description(introduction))

    objectives = get("learning_objectives", []) or []
    if objectives:
        blocks.append(heading("Learning Objectives"))
        blocks.append(bullet_list(list(objectives)))

    estimated = get("estimated_minutes", None)
    if estimated:
        blocks.append(description(f"Estimated study time: {estimated} minutes"))

    # Main instructional content, exactly as the builder tools produced it.
    blocks.extend(get("sections", []) or [])

    terms = get("key_terms", []) or []
    if terms:
        blocks.append(heading("Key Terms"))
        blocks.append(key_terms_accordion(_as_dicts(list(terms))))

    summary = get("summary", "") or ""
    if summary:
        blocks.append(heading("Summary"))
        blocks.append(description(summary))

    return blocks
