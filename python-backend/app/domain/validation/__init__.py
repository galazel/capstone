"""Deterministic content-quality validation.

Split from the structural rules enforced in the Pydantic models: those
represent *impossible* content (an MCQ with three choices) and raise so the
retry policy asks the model again. These represent *poor* content (duplicate
questions, recall-only Bloom's coverage, filler distractors) which is real
but not fatal, so it is reported for the reviewing admin to judge.
"""

from app.domain.validation.lessons import validate_lesson, validate_lessons
from app.domain.validation.questions import find_duplicates, validate_question_batch
from app.domain.validation.report import (
    Severity,
    ValidationIssue,
    ValidationReport,
)

__all__ = [
    "find_duplicates",
    "validate_question_batch",
    "validate_lesson",
    "validate_lessons",
    "Severity",
    "ValidationIssue",
    "ValidationReport",
]
