"""User-message builders for the certification workflow."""

from __future__ import annotations

from typing import Any


def build_document_audit_prompt(
    certification_name: str, certification_description: str, document_samples: str
) -> str:
    return (
        f"Certification Name: {certification_name}\n"
        f"Description: {certification_description}\n\n"
        f"Document Samples:\n{document_samples}"
    )


def build_curriculum_prompt(
    certification_name: str, certification_description: str, context: str
) -> str:
    return f"""
Create a complete certification curriculum.

Certification:
{certification_name}

Description:
{certification_description}

Reference Materials:
{context}

Generate the curriculum now.
""".strip()


def build_lesson_prompt(
    certification_name: str,
    major: dict[str, Any],
    middle: dict[str, Any],
    lesson: dict[str, Any],
) -> str:
    return f"""
Generate a complete lesson.

Certification:
{certification_name}

Major Category:
{major.get("name", "")}

Middle Category:
{middle.get("name", "")}

Lesson:
{lesson.get("name", "")}

Learning Objective:
{lesson.get("learning_objective", "")}

Lesson Instructions:
{lesson.get("lessonGenerationInstructions", "")}
""".strip()


def build_lesson_audit_prompt(certification_name: str, curriculum: Any, lessons: Any) -> str:
    return f"""
Review the generated lessons.

Certification:
{certification_name}

Curriculum:
{curriculum}

Generated Lessons:
{lessons}

Determine whether every generated lesson follows the curriculum,
learning objectives, and lessonGenerationInstructions.
""".strip()
