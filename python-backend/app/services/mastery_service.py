from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import (
    BktMasteryEvent,
    BktProcessedEvent,
    LearnerLessonMastery,
    LearnerLessonMasteryHistory,
)
from app.schemas.certification.mastery import MasteryEventCreate, MasteryEventResponse, ParametersUsed
from app.services import category_service, priority_service
from app.services.bkt_math import mastery_level, update_mastery
from app.services.parameter_service import resolve_parameters

LOGGER = logging.getLogger(__name__)


def _payload_hash(payload: MasteryEventCreate) -> str:
    canonical = json.dumps(
        {
            "source_event_id": payload.source_event_id,
            "learner_id": payload.learner_id,
            "lesson_id": payload.lesson_id,
            "question_id": payload.question_id,
            "is_correct": payload.is_correct,
            "difficulty_level": payload.difficulty_level,
            "assessment_type": payload.assessment_type,
        },
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _response_from_event(
    event: BktMasteryEvent,
    mastery: LearnerLessonMastery,
    *,
    duplicate: bool,
) -> MasteryEventResponse:
    params = event.parameters_used
    return MasteryEventResponse(
        source_event_id=event.source_event_id,
        duplicate=duplicate,
        learner_id=event.learner_id,
        lesson_id=event.lesson_id,
        question_id=event.question_id,
        is_correct=event.is_correct,
        predicted_correct_probability=event.predicted_correct_probability,
        mastery_before=event.mastery_before,
        mastery_posterior=event.mastery_posterior,
        mastery_after=event.mastery_after,
        mastery_level=mastery.mastery_level,
        attempt_count=mastery.attempt_count,
        parameters_used=ParametersUsed(**params),
        processed_at=event.processed_at,
    )


def _find_duplicate_response(session: Session, source_event_id: str) -> MasteryEventResponse | None:
    existing_event = session.scalar(
        select(BktMasteryEvent).where(BktMasteryEvent.source_event_id == source_event_id)
    )
    if existing_event is None:
        return None
    mastery = session.get(
        LearnerLessonMastery,
        (existing_event.learner_id, existing_event.lesson_id),
    )
    if mastery is None:
        raise RuntimeError("Mastery event exists but its mastery row is missing")
    return _response_from_event(existing_event, mastery, duplicate=True)


def process_mastery_event(session: Session, payload: MasteryEventCreate) -> MasteryEventResponse:
    duplicate = _find_duplicate_response(session, payload.source_event_id)
    if duplicate is not None:
        return duplicate

    # A concurrent first-ever event for the same learner+lesson can race here:
    # both requests see no existing LearnerLessonMastery row (nothing to lock
    # with SELECT ... FOR UPDATE), both attempt an insert, and the loser hits
    # the table's (learner_id, lesson_id) primary-key conflict on commit. That
    # is a different event (different source_event_id) than the one already
    # committed, so the plain "is this a duplicate delivery" check above can't
    # catch it. Retry once: by the time we retry, the winner's row exists, so
    # this attempt's SELECT ... FOR UPDATE finds and locks it instead of
    # trying a second blind insert.
    last_error: IntegrityError | None = None
    for attempt in range(2):
        try:
            return _process_mastery_event_once(session, payload)
        except IntegrityError as exc:
            session.rollback()
            duplicate = _find_duplicate_response(session, payload.source_event_id)
            if duplicate is not None:
                return duplicate
            last_error = exc
            if attempt == 0:
                LOGGER.warning(
                    "Mastery row conflict for learner %s lesson %s (likely a concurrent "
                    "first event); retrying once",
                    payload.learner_id,
                    payload.lesson_id,
                )
                continue
            raise

    # Unreachable, but keeps type-checkers happy about a guaranteed return/raise above.
    raise last_error  # pragma: no cover


def _process_mastery_event_once(session: Session, payload: MasteryEventCreate) -> MasteryEventResponse:
    settings = get_settings()
    parameters = resolve_parameters(
        session,
        lesson_id=payload.lesson_id,
        difficulty_level=payload.difficulty_level,
        assessment_type=payload.assessment_type,
    )

    mastery = session.scalar(
        select(LearnerLessonMastery)
        .where(
            LearnerLessonMastery.learner_id == payload.learner_id,
            LearnerLessonMastery.lesson_id == payload.lesson_id,
        )
        .with_for_update()
    )
    previous_level = mastery.mastery_level if mastery else None

    # Online, per-event scoring always uses the incremental Bayes+forget
    # update below rather than pyBKT's Model.predict(): pyBKT has no API for
    # a single-step update from an arbitrary starting probability, so it can
    # only score a new observation by replaying the learner's ENTIRE event
    # history for that lesson on every single request -- growing cost per
    # event, executed while holding this row's lock. The math below is the
    # same Bayes-rule-plus-forgetting update pyBKT itself applies at each
    # step; what actually needs pyBKT's EM fitting is estimating good
    # prior/learn/guess/slip/forget parameters per lesson/class in the first
    # place, which happens offline in the weekly training job
    # (app.ml.pipeline / training_service) and is already what
    # resolve_parameters() reads back here.
    fallback_prior = mastery.mastery_probability if mastery else parameters.prior
    result = update_mastery(
        mastery_before=fallback_prior,
        is_correct=payload.is_correct,
        learn=parameters.learn,
        guess=parameters.guess,
        slip=parameters.slip,
        forget=parameters.forget,
    )
    mastery_before = result.mastery_before
    mastery_posterior = result.mastery_posterior
    mastery_after = result.mastery_after
    predicted_correct_probability = result.predicted_correct_probability

    level = mastery_level(
        mastery_after,
        developing_threshold=settings.developing_threshold,
        good_threshold=settings.good_threshold,
        mastered_threshold=settings.mastered_threshold,
    )
    now = datetime.now(timezone.utc)

    if mastery is None:
        mastery = LearnerLessonMastery(
            learner_id=payload.learner_id,
            lesson_id=payload.lesson_id,
            mastery_probability=mastery_after,
            mastery_level=level,
            attempt_count=1,
            last_event_id=payload.source_event_id,
            last_updated=now,
        )
        session.add(mastery)
    else:
        mastery.mastery_probability = mastery_after
        mastery.mastery_level = level
        mastery.attempt_count += 1
        mastery.last_event_id = payload.source_event_id
        mastery.last_updated = now

    # Evidence counters + curriculum path (kept current from each event).
    if payload.is_correct:
        mastery.correct_count = (mastery.correct_count or 0) + 1
    else:
        mastery.incorrect_count = (mastery.incorrect_count or 0) + 1
    mastery.certification_id = payload.certification_id or mastery.certification_id
    mastery.middle_category_id = payload.middle_category_id or mastery.middle_category_id
    mastery.major_category_id = payload.major_category_id or mastery.major_category_id
    mastery.lesson_title = payload.lesson_title or mastery.lesson_title
    mastery.middle_category_title = payload.middle_category_title or mastery.middle_category_title
    mastery.major_category_title = payload.major_category_title or mastery.major_category_title
    mastery.last_assessment_type = payload.assessment_type

    event = BktMasteryEvent(
        source_event_id=payload.source_event_id,
        learner_id=payload.learner_id,
        lesson_id=payload.lesson_id,
        question_id=payload.question_id,
        is_correct=payload.is_correct,
        difficulty_level=payload.difficulty_level,
        assessment_type=payload.assessment_type,
        mastery_before=mastery_before,
        mastery_posterior=mastery_posterior,
        mastery_after=mastery_after,
        predicted_correct_probability=predicted_correct_probability,
        parameters_used=parameters.as_dict(),
        occurred_at=payload.occurred_at,
        processed_at=now,
    )
    session.add(event)

    # Audit trail for result-page mastery changes and analytics.
    session.add(
        LearnerLessonMasteryHistory(
            event_id=payload.source_event_id,
            learner_id=payload.learner_id,
            certification_id=payload.certification_id,
            lesson_id=payload.lesson_id,
            previous_mastery=mastery_before,
            observation_posterior=mastery_posterior,
            final_mastery=mastery_after,
            previous_mastery_level=previous_level,
            new_mastery_level=level,
            observed_correct=payload.is_correct,
            assessment_type=payload.assessment_type,
            difficulty_level=payload.difficulty_level,
            model_version=parameters.model_variant,
            created_at=now,
        )
    )
    # Idempotency ledger with a deterministic payload hash for conflict detection.
    session.add(
        BktProcessedEvent(
            event_id=payload.source_event_id,
            learner_id=payload.learner_id,
            certification_id=payload.certification_id,
            exam_question_id=payload.question_id,
            payload_hash=_payload_hash(payload),
            processing_status="PROCESSED",
            processed_at=now,
        )
    )

    # Recalculate the lesson priority and roll it up into the parent middle and
    # major categories, in the SAME transaction. Requires the curriculum path.
    if payload.certification_id is not None:
        session.flush()
        computed = priority_service.compute_lesson_priority(mastery, settings)
        priority_service.upsert_priority(
            session,
            learner_id=payload.learner_id,
            certification_id=payload.certification_id,
            category_type="LESSON",
            category_id=payload.lesson_id,
            title=payload.lesson_title or mastery.lesson_title,
            computed=computed,
            settings=settings,
            model_version=parameters.model_variant,
            last_assessment_type=payload.assessment_type,
            source_event_id=payload.source_event_id,
            major_category_id=payload.major_category_id,
            middle_category_id=payload.middle_category_id,
            lesson_id=payload.lesson_id,
        )
        category_service.recompute_categories(
            session,
            learner_id=payload.learner_id,
            certification_id=payload.certification_id,
            settings=settings,
            source_event_id=payload.source_event_id,
            model_version=parameters.model_variant,
            major_category_id=payload.major_category_id,
            middle_category_id=payload.middle_category_id,
        )

    session.commit()
    session.refresh(event)
    session.refresh(mastery)
    return _response_from_event(event, mastery, duplicate=False)
