"""Read/write helpers over the Java-owned tables in app.db.java_tables.

Used by the Phase 6 RabbitMQ consumers, which run outside any request scope
and therefore manage their own short-lived sessions rather than depending on
FastAPI's get_db().
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.db.java_tables import (
    assessment_attempts,
    certifications,
    choices,
    diagram_question_configs,
    exam_questions,
    exam_types,
    exams,
    generation_requests,
    knowledge_documents,
    learners,
    lessons,
    major_categories,
    middle_categories,
    notifications,
    programming_question_configs,
    programming_test_cases,
    questions,
    text_question_configs,
)


def get_generation_request(session: Session, generation_request_id: int) -> dict[str, Any] | None:
    row = session.execute(
        select(generation_requests).where(
            generation_requests.c.generation_request_id == generation_request_id
        )
    ).mappings().first()
    return dict(row) if row else None


def mark_generation_request_processing(session: Session, generation_request_id: int) -> None:
    session.execute(
        update(generation_requests)
        .where(generation_requests.c.generation_request_id == generation_request_id)
        .values(status="PROCESSING", updated_at=datetime.now(timezone.utc))
    )
    session.commit()


def mark_generation_request_done(session: Session, generation_request_id: int) -> None:
    now = datetime.now(timezone.utc)
    session.execute(
        update(generation_requests)
        .where(generation_requests.c.generation_request_id == generation_request_id)
        .values(status="DONE", updated_at=now, completed_at=now)
    )
    session.commit()


def mark_generation_request_failed(session: Session, generation_request_id: int, error_message: str) -> None:
    session.execute(
        update(generation_requests)
        .where(generation_requests.c.generation_request_id == generation_request_id)
        .values(status="FAILED", error_message=error_message, updated_at=datetime.now(timezone.utc))
    )
    session.commit()


def get_lesson(session: Session, lesson_id: int) -> dict[str, Any] | None:
    row = session.execute(
        select(lessons.c.lesson_id, lessons.c.name, lessons.c.lesson_component_structure).where(
            lessons.c.lesson_id == lesson_id
        )
    ).mappings().first()
    return dict(row) if row else None


def get_certification(session: Session, certification_id: int) -> dict[str, Any] | None:
    row = session.execute(
        select(certifications).where(certifications.c.certification_id == certification_id)
    ).mappings().first()
    return dict(row) if row else None


def list_knowledge_documents(
    session: Session, certification_id: int, use_case: str
) -> list[dict[str, Any]]:
    rows = session.execute(
        select(knowledge_documents).where(
            knowledge_documents.c.certification_id == certification_id,
            knowledge_documents.c.use_case == use_case,
            knowledge_documents.c.status == "READY",
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def insert_major_category(session: Session, certification_id: int, title: str) -> int:
    result = session.execute(
        insert(major_categories).values(certification_id=certification_id, title=title)
    )
    return result.inserted_primary_key[0]


def insert_middle_category(session: Session, major_category_id: int, title: str) -> int:
    result = session.execute(
        insert(middle_categories).values(major_category_id=major_category_id, title=title)
    )
    return result.inserted_primary_key[0]


def insert_lesson(
    session: Session, middle_category_id: int, name: str, lesson_component_structure: Any = None
) -> int:
    """`lesson_component_structure` is a jsonb column, so this takes a
    JSON-able object (list/dict), not a serialized string."""
    result = session.execute(
        insert(lessons).values(
            middle_category_id=middle_category_id,
            name=name,
            lesson_component_structure=lesson_component_structure if lesson_component_structure is not None else [],
        )
    )
    return result.inserted_primary_key[0]


def get_assessment_attempt_with_recipient(session: Session, assessment_attempt_id: int) -> dict[str, Any] | None:
    """Fetches an attempt joined to its exam and the learner's user_id, the
    path notifications use to reach the learner who owns this attempt."""
    row = session.execute(
        select(
            assessment_attempts.c.assessment_attempt_id,
            assessment_attempts.c.exam_id,
            assessment_attempts.c.learner_id,
            assessment_attempts.c.attempt_number,
            assessment_attempts.c.status,
            assessment_attempts.c.percentage,
            assessment_attempts.c.passed,
            exams.c.title.label("exam_title"),
            learners.c.user_id,
        )
        .select_from(
            assessment_attempts.join(exams, exams.c.exam_id == assessment_attempts.c.exam_id).join(
                learners, learners.c.learner_id == assessment_attempts.c.learner_id
            )
        )
        .where(assessment_attempts.c.assessment_attempt_id == assessment_attempt_id)
    ).mappings().first()
    return dict(row) if row else None


def insert_notification(session: Session, user_id: int, title: str, body: str, href: str | None = None) -> None:
    session.execute(
        insert(notifications).values(
            user_id=user_id,
            title=title,
            body=body,
            href=href,
            created_at=datetime.now(timezone.utc),
        )
    )
    session.commit()


# --- assessment persistence (Phase 2b) -----------------------------------
# Everything generated -- curriculum, questions, and the exams that group
# them -- is written back into Java's schema so it is usable by the learner
# app, the adaptive retake selector, and BKT, rather than living only in a
# LangGraph checkpoint.

def list_certification_lessons(session: Session, certification_id: int) -> list[dict[str, Any]]:
    """All lessons under a certification, for resolving a question's
    `lesson_ref` name to a real lesson_id."""
    rows = session.execute(
        select(lessons.c.lesson_id, lessons.c.name, lessons.c.middle_category_id)
        .select_from(
            lessons.join(
                middle_categories,
                middle_categories.c.middle_category_id == lessons.c.middle_category_id,
            ).join(
                major_categories,
                major_categories.c.major_category_id == middle_categories.c.major_category_id,
            )
        )
        .where(major_categories.c.certification_id == certification_id)
    ).mappings().all()
    return [dict(row) for row in rows]


def get_exam_type_id(session: Session, exam_type_text: str) -> int | None:
    return session.execute(
        select(exam_types.c.exam_type_id).where(exam_types.c.exam_type_text == exam_type_text)
    ).scalar_one_or_none()


def insert_question(
    session: Session,
    *,
    lesson_id: int,
    question_type: str,
    difficulty: str,
    question_text: str,
    total_points: float = 1.0,
) -> int:
    result = session.execute(
        insert(questions).values(
            lesson_id=lesson_id,
            question_type=question_type,
            difficulty_level=difficulty,
            question_text=question_text,
            total_points=total_points,
            created_at=datetime.now(timezone.utc),
        )
    )
    return result.inserted_primary_key[0]


def insert_choice(
    session: Session, question_id: int, text: str, is_correct: bool, explanation: str | None = None
) -> None:
    session.execute(
        insert(choices).values(
            question_id=question_id,
            choice_text=text,
            is_correct=is_correct,
            explanation=explanation,
        )
    )


def insert_text_config(
    session: Session, question_id: int, correct_answer: str, checking_method: str
) -> None:
    session.execute(
        insert(text_question_configs).values(
            question_id=question_id,
            correct_answer=correct_answer,
            checking_method=checking_method,
        )
    )


def insert_programming_config(
    session: Session, question_id: int, starter_code: str | None, test_cases: list[dict[str, Any]]
) -> None:
    result = session.execute(
        insert(programming_question_configs).values(
            question_id=question_id, starter_code=starter_code
        )
    )
    config_id = result.inserted_primary_key[0]
    for index, case in enumerate(test_cases or []):
        session.execute(
            insert(programming_test_cases).values(
                programming_question_config_id=config_id,
                input_data=case.get("input_data", ""),
                expected_output=case.get("expected_output", ""),
                # First case is the worked example shown to the learner.
                is_sample=(index == 0),
            )
        )


def insert_diagram_config(
    session: Session, question_id: int, diagram_type: str, instructions: str | None
) -> None:
    """reference_diagram_xml/json are NOT NULL in Java's schema but the
    generator produces neither, so they are written empty. Such a question is
    answerable and human-gradable but cannot be auto-graded."""
    session.execute(
        insert(diagram_question_configs).values(
            question_id=question_id,
            diagram_type=diagram_type,
            instructions=instructions,
            reference_diagram_xml="",
            reference_diagram_json={},
        )
    )


def insert_exam(
    session: Session,
    *,
    certification_id: int,
    exam_type_id: int,
    title: str,
    total_questions: int,
    target_scope: str | None = None,
    lesson_id: int | None = None,
    middle_category_id: int | None = None,
    major_category_id: int | None = None,
    passing_score: float = 70.0,
) -> int:
    result = session.execute(
        insert(exams).values(
            certification_id=certification_id,
            exam_type_id=exam_type_id,
            title=title,
            # AI-authored, and DRAFT so nothing reaches learners until an
            # admin publishes it.
            is_generated=True,
            status="DRAFT",
            total_questions=total_questions,
            passing_score=passing_score,
            target_scope=target_scope,
            lesson_id=lesson_id,
            middle_category_id=middle_category_id,
            major_category_id=major_category_id,
            updated_at=datetime.now(timezone.utc),
        )
    )
    return result.inserted_primary_key[0]


def insert_exam_question(
    session: Session, exam_id: int, question_id: int, display_order: int, points: float = 1.0
) -> None:
    session.execute(
        insert(exam_questions).values(
            exam_id=exam_id,
            question_id=question_id,
            display_order=display_order,
            points=points,
        )
    )


def update_certification_exam_structure(
    session: Session, certification_id: int, exam_structure: Any
) -> None:
    """Records the real exam's shape on the certification row.

    The curriculum planner researches this ({total_items, question_types,
    notes}) and the mock exam generator consumes it, but it used to live only
    in the LangGraph checkpoint -- so it was discarded when the run finished,
    leaving nothing to show an admin and nothing to regenerate a mock exam
    from without re-planning the whole curriculum.
    """
    session.execute(
        update(certifications)
        .where(certifications.c.certification_id == certification_id)
        .values(exam_structure=exam_structure)
    )


def update_lesson_content(session: Session, lesson_id: int, blocks: Any) -> None:
    """Writes a generated lesson's display blocks into the jsonb column the
    lesson editor and learner view render from."""
    session.execute(
        update(lessons)
        .where(lessons.c.lesson_id == lesson_id)
        .values(lesson_component_structure=blocks)
    )
