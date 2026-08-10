"""Flattens a lesson's stored content blocks into plain text for the tutor.

`lessons.lesson_component_structure` is a jsonb array of display blocks (see
`frontend/src/components/certifications/lesson-content-renderer.jsx` for the
full block vocabulary: heading, description, image-left-text, tabs,
accordion, ...). The tutor doesn't need to understand that shape -- it just
needs the words -- so this walks the tree and collects every string that
looks like lesson prose, skipping the fields that are asset references
rather than content (image/video keys, source URLs, raw type/id tags).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.repositories.java_backend import get_lesson

#: Keys that hold identifiers or asset pointers, not words a tutor should read.
_SKIP_KEYS = {
    "type",
    "id",
    "imagekey",
    "videokey",
    "sourceurl",
    "sourcename",
    "key",
    "href",
    "url",
    "icon",
}

#: Plain text this large already carries more lesson content than a tutor
#: reply needs, and keeps a chatty lesson from ballooning every turn's prompt.
_MAX_CHARS = 8000


def _collect_strings(value: Any, out: list[str]) -> None:
    if isinstance(value, str):
        text = value.strip()
        if text:
            out.append(text)
        return

    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in _SKIP_KEYS:
                continue
            _collect_strings(item, out)
        return

    if isinstance(value, list):
        for item in value:
            _collect_strings(item, out)


def flatten_lesson_blocks(blocks: Any) -> str:
    strings: list[str] = []
    _collect_strings(blocks, strings)
    text = "\n".join(strings)
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS] + "\n...(truncated)"
    return text


def load_lesson_context(session: Session, lesson_id: int) -> str | None:
    """The lesson's title and flattened body text, or `None` if it has no
    content yet (a lesson still being generated, or an unrecognised id)."""
    lesson = get_lesson(session, lesson_id)
    if not lesson:
        return None

    body = flatten_lesson_blocks(lesson.get("lesson_component_structure"))
    if not body:
        return None

    return f"Lesson: {lesson['name']}\n\n{body}"
