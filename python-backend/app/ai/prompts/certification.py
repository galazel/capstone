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


def _key_topics(lesson: dict[str, Any]) -> str:
    """The planner's topic list for a lesson, as prompt text.

    Falls back to the old `lessonGenerationInstructions` object so a run whose
    curriculum was checkpointed before the planner was slimmed down still
    carries its guidance into the lesson prompt -- those runs resume from
    Postgres and would otherwise lose it silently. See
    `app.schemas.certification.curriculum_schema`.
    """
    topics = lesson.get("key_topics")
    if isinstance(topics, (list, tuple)):
        return "\n".join(f"- {topic}" for topic in topics if topic)
    return str(topics or lesson.get("lessonGenerationInstructions") or "")


def build_lesson_prompt(
    certification_name: str,
    major: dict[str, Any],
    middle: dict[str, Any],
    lesson: dict[str, Any],
) -> str:
    prompt = f"""
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

Key Topics to cover:
{_key_topics(lesson)}

Every topic listed above MUST be taught in this lesson -- explained, worked
through and exemplified, not named in passing. This list is the curriculum's
guarantee that the certification covers its whole domain: a topic assigned
here and skipped is a topic the learner is never taught anywhere, because no
other lesson is responsible for it. Give each one its own section or sections.
""".strip()

    # Carried as its own field rather than appended to the topic list, so
    # reviewer prose can never be mistaken for a topic the lesson must cover.
    feedback = lesson.get("review_feedback")
    if feedback:
        prompt += (
            "\n\nReviewer feedback on the previous version of this lesson "
            f"-- apply it:\n{feedback}"
        )
    return prompt


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
its learning objective, and its key topics.
""".strip()
