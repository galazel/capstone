"""Reading an agent's answer as JSON, for schemas a tool call cannot carry.

Groq parses and validates a tool call's arguments *server-side* and answers
HTTP 400 `tool_use_failed` when they do not, so a malformed call never reaches
this process and nothing here can repair it. That is a good trade for small,
shallow schemas. It is fatal for the curriculum planner, whose live failure
mode is not an invalid object but a *truncated* one:

    ..."with a time limit of 3 hours."}}     <- ends here; `]` and `}` never came

Five consecutive samples died that way and took the run with them. The payload
was not too long (~1.3k tokens against a 6k ceiling) and it was not
schema-invalid -- appending the two missing characters yields a complete,
valid curriculum. The model simply stopped emitting closing brackets once it
had said everything it had to say, and the provider threw the whole thing away.

Asking for plain JSON instead moves that failure inside this process, where
those two characters are recoverable and the rest of the repair machinery in
`app.schemas.certification.curriculum_schema` -- which already un-nests the
model's favourite structural mistakes -- finally gets to see the payload it was
written for.

What is given up is the provider's own validation, which is why everything
below raises `ValueError`: `app.ai.retry` classifies that as malformed output
and resamples, exactly as it does for a locally-rejected tool call. A sample
this cannot rescue costs one more attempt, not a failed run.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_CLOSING = {"{": "}", "[": "]"}


def _content_text(content: Any) -> str:
    """The text of a message, whether it arrives as a string or as blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return "\n".join(parts)
    return ""


def final_message_text(response: Any) -> str:
    """The prose of an agent run's last message.

    Raises rather than returning "" for an empty run, so a model that answered
    with nothing at all is resampled instead of failing later as "no JSON".
    """
    messages = response.get("messages") if isinstance(response, dict) else None
    if not messages:
        raise ValueError("Agent returned no messages.")
    text = _content_text(getattr(messages[-1], "content", messages[-1]))
    if not text.strip():
        raise ValueError("Agent's final message was empty.")
    return text


def _closed(text: str, start: int) -> str:
    """The JSON value beginning at `start`, closed off if it was cut short.

    Walks the text once, string-aware, remembering the end of the last
    *complete* container. A payload that terminates cleanly returns unchanged;
    one that stops mid-flight is truncated back to that last complete container
    and the still-open ones are closed.

    Trimming back to a container boundary rather than closing at the very end
    is what makes this safe: the cut can land inside a string, or after a
    trailing comma, and neither is fixed by appending brackets. The cost is at
    most one partly-written lesson, which `_require_breadth` then judges on its
    merits.
    """
    stack: list[str] = []
    safe_end: int | None = None
    safe_stack: tuple[str, ...] = ()
    in_string = False
    escaped = False

    for index in range(start, len(text)):
        char = text[index]
        if escaped:
            escaped = False
            continue
        if in_string:
            if char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char in _CLOSING:
            stack.append(_CLOSING[char])
        elif char in ("}", "]"):
            if not stack or stack[-1] != char:
                raise ValueError("Model output has mismatched JSON brackets.")
            stack.pop()
            if not stack:
                return text[start : index + 1]
            safe_end, safe_stack = index + 1, tuple(stack)

    if safe_end is None:
        raise ValueError("Model output contains no complete JSON value.")

    logger.warning(
        "Model output was cut short after %d characters; closing %d unterminated "
        "container(s) and discarding %d trailing character(s)",
        safe_end - start, len(safe_stack), len(text) - safe_end,
    )
    return text[start:safe_end] + "".join(reversed(safe_stack))


def extract_json_object(text: str, *, label: str = "output") -> dict:
    """The JSON object in `text`, tolerating prose or fences around it.

    Starts at the first `{` rather than requiring the whole message to be
    JSON, because an agent that has just used a search tool likes to introduce
    its answer.
    """
    start = text.find("{")
    if start < 0:
        raise ValueError(f"{label} contained no JSON object.")

    payload = _closed(text, start)
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as error:
        raise ValueError(f"{label} was not valid JSON: {error}") from error

    if not isinstance(value, dict):
        raise ValueError(f"{label} returned a {type(value).__name__}, not a JSON object.")
    return value
