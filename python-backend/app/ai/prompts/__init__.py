"""Prompt text and prompt builders.

Kept out of the node functions so prompts can be reviewed, diffed, and
reused without reading orchestration code -- previously every user-message
prompt was an inline f-string inside the node that happened to call the
model, which meant prompt changes and control-flow changes landed in the
same diffs.

Agent *system* prompts still live beside their factories in `app/agents/`,
since each is bound to exactly one agent; the builders here are the
per-invocation user messages.
"""

from app.ai.prompts.certification import (
    build_curriculum_prompt,
    build_document_audit_prompt,
    build_lesson_audit_prompt,
    build_lesson_prompt,
)
from app.ai.prompts.question import build_question_batch_prompt

__all__ = [
    "build_curriculum_prompt",
    "build_document_audit_prompt",
    "build_lesson_audit_prompt",
    "build_lesson_prompt",
    "build_question_batch_prompt",
]
