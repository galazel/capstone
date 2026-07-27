"""Validation report model.

A report is *advisory*: it never blocks generation on its own. It is attached
to the HITL review payload so an admin sees what the AI check found alongside
the artifact itself, which is what the Phase 2 brief asks for ("the frontend
must display the generated artifact together with its AI validation report").

Structural impossibilities (an MCQ with three choices) are not reported here
-- those raise in `QuestionDraft` and are retried. This layer is for quality
problems that are real but not fatal.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Severity(str, Enum):
    #: Blocks nothing, but an admin should look.
    WARNING = "WARNING"
    #: Strongly suggests regeneration.
    ERROR = "ERROR"
    #: Purely informational (e.g. distribution stats).
    INFO = "INFO"


class ValidationIssue(BaseModel):
    code: str
    severity: Severity
    message: str
    #: Indices into the validated batch, when the issue is about specific
    #: questions rather than the batch as a whole.
    question_indices: list[int] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class ValidationReport(BaseModel):
    issues: list[ValidationIssue] = Field(default_factory=list)
    #: 0-100. A blunt single number for the dashboard; the issues list is
    #: the real signal.
    score: int = 100
    stats: dict[str, Any] = Field(default_factory=dict)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity is Severity.ERROR]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity is Severity.WARNING]

    @property
    def passed(self) -> bool:
        """No ERROR-level issues. Warnings alone still pass."""
        return not self.errors
