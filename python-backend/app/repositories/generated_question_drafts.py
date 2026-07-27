from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import GeneratedQuestionDraft


def save_draft(
    session: Session,
    *,
    generation_request_id: int,
    certification_id: int,
    thread_id: str,
    questions: list[dict],
) -> GeneratedQuestionDraft:
    draft = GeneratedQuestionDraft(
        generation_request_id=generation_request_id,
        certification_id=certification_id,
        thread_id=thread_id,
        questions=questions,
        generated_count=len(questions),
    )
    session.add(draft)
    session.commit()
    return draft
