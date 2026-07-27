import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

from app.schemas.certification.curriculum_schema import CertificationCurriculum
from app.schemas.certification.lesson_audit import LessonAuditResult
from app.schemas.certification.lesson_schema import GeneratedLesson
from .state import CertificationState
from app.ai.invocation import invoke_agent, invoke_question_agent, questions_as_dicts
from app.domain.lesson_blocks import lesson_to_blocks
from app.domain.validation import validate_lessons
from app.ai.prompts.certification import (
    build_curriculum_prompt,
    build_document_audit_prompt,
    build_lesson_audit_prompt,
    build_lesson_prompt,
)
from app.rag.chunking import chunk_documents
from app.rag.loaders import fetch_document_ref, load_upload, resolve_documents
from app.rag.retriever import retrieve_context
from app.rag.store import add_documents, namespace_for
from app.agents.certification.auditor_document_agent import get_auditor_agent
from app.agents.certification.curriculum_agent import get_curriculum_agent
from app.agents.certification.lesson_agent import get_lesson_generation_agent
from app.agents.certification.auditor_lesson import get_auditor_lesson_agent
from langgraph.types import Send, interrupt


load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

logger = logging.getLogger(__name__)


# Exact question counts per assessment type.
LESSON_QUIZ_QUESTION_COUNT = 10
MIDDLE_QUIZ_QUESTION_COUNT = 20
MAJOR_QUIZ_QUESTION_COUNT = 50
DIAGNOSTIC_EXAM_QUESTION_COUNT = 40
MOCK_EXAM_QUESTION_COUNT = 60
QUESTION_BANK_QUESTION_COUNT = 100


def _namespace(state: CertificationState) -> str:
    """Index key for this run. Scoping the index per certification is what
    stops one ingestion from overwriting another's vectors."""
    return namespace_for(
        certification_id=state.get("certification_id"),
        certification_name=state.get("certification_name", ""),
    )


async def document_ingestion_node(state: CertificationState):
    logger.info("Document ingestion started")

    # PDF parsing, embedding, and FAISS writes are CPU-bound and release no
    # GIL time voluntarily -- run them off the event loop so a large upload
    # can't stall every other in-flight request.
    documents = await asyncio.to_thread(
        resolve_documents, state.get("document_refs"), state.get("uploaded_files")
    )
    if not documents:
        raise RuntimeError("No readable text could be extracted from the uploaded documents.")

    chunks = await asyncio.to_thread(
        chunk_documents,
        documents,
        certification_id=state.get("certification_id"),
        certification_name=state.get("certification_name", ""),
    )

    namespace = _namespace(state)
    added = await asyncio.to_thread(add_documents, namespace, chunks)
    logger.info("Indexed %d chunks into namespace '%s'", added, namespace)

    return {
        "vector_store_id": namespace,
        # Drop any inline bytes now that the content is indexed. Nothing
        # downstream reads the raw files again (generation retrieves from
        # FAISS), so keeping them would re-serialize the whole upload into
        # every remaining checkpoint for no benefit.
        "uploaded_files": [],
        "status": "DOCUMENT_PROCESSING_COMPLETED",
    }


async def _invoke_auditor(state: CertificationState, combined_samples: str):
    return await invoke_agent(
        get_auditor_agent(),
        build_document_audit_prompt(
            state["certification_name"], state["certification_description"], combined_samples
        ),
    )


async def validate_documents_node(state: CertificationState):
    logger.info("Document validation started")

    # Only the first ~300 chars of each file are needed to judge relevance,
    # so this deliberately parses rather than indexes.
    sample_texts = []
    for ref in state.get("document_refs") or []:
        pages = await asyncio.to_thread(fetch_document_ref, ref)
        if pages:
            sample_texts.append(
                f"Filename: {ref.get('filename', '')}\nContent Sample: {pages[0].page_content[:300]}"
            )
    for file in state.get("uploaded_files") or []:
        pages = await asyncio.to_thread(
            load_upload, file["content"], file["type"], file.get("filename", "")
        )
        if pages:
            sample = pages[0].page_content[:300]
            sample_texts.append(f"Filename: {file.get('filename', '')}\nContent Sample: {sample}")

    combined_samples = "\n\n---\n\n".join(sample_texts)

    audit = await _invoke_auditor(state, combined_samples)

    if audit.is_related:
        logger.info("Document validation passed")
        return {"status": "VALIDATION_PASSED"}

    logger.warning("Document validation failed: %s", audit.reason)
    return {
        "status": "VALIDATION_FAILED",
        "error_message": audit.reason or "Documents are not related to the certification.",
    }


def route_after_validation(state: CertificationState) -> str:
    if state.get("status") == "VALIDATION_PASSED":
        return "continue"
    return "stop"


async def _invoke_curriculum_agent(state: CertificationState, context: str) -> CertificationCurriculum:
    return await invoke_agent(
        get_curriculum_agent(),
        build_curriculum_prompt(
            state["certification_name"], state["certification_description"], context
        ),
    )


async def curriculum_planning_agent_node(state: CertificationState):
    logger.info("Curriculum planning started")

    try:
        # No metadata filter: the index is already scoped to this
        # certification, so cross-certification bleed is impossible by
        # construction rather than by post-filtering.
        context = await asyncio.to_thread(
            retrieve_context,
            _namespace(state),
            f"certification domains, exam objectives, knowledge areas, skills and "
            f"learning requirements for {state['certification_name']}",
        )
        if not context:
            logger.warning(
                "No indexed context retrieved for '%s'; curriculum will be "
                "generated from title/description alone",
                state["certification_name"],
            )

        curriculum = await _invoke_curriculum_agent(state, context)

        logger.info("Curriculum generated successfully")
        return {
            "curriculum": curriculum.curriculum.model_dump(by_alias=True),
            "status": "CURRICULUM_CREATED",
        }

    except Exception as e:
        logger.exception("Curriculum planning failed")
        raise RuntimeError("Curriculum generation failed.") from e


def await_curriculum_review_node(state: CertificationState):
    """HITL checkpoint: pauses after the curriculum is planned, before any
    quizzes/lessons are generated from it, so an admin can review the
    structure. Resume with Command(resume="approve") or
    Command(resume="regenerate")."""
    decision = interrupt({
        "stage": "CURRICULUM",
        "payload": state["curriculum"],
    })
    return {"review_decision": decision, "status": "CURRICULUM_REVIEWED"}


def route_after_review(state: CertificationState) -> str:
    return "regenerate" if state.get("review_decision") == "regenerate" else "approve"


def _flatten_majors(curriculum: dict) -> list[dict]:
    return curriculum.get("majorCategories", []) or []


def _flatten_middles(curriculum: dict) -> list[tuple[dict, dict]]:
    pairs = []
    for major in _flatten_majors(curriculum):
        for middle in major.get("middleCategories", []) or []:
            pairs.append((major, middle))
    return pairs


async def _invoke_lesson_agent(state: CertificationState) -> GeneratedLesson:
    return await invoke_agent(
        get_lesson_generation_agent(),
        build_lesson_prompt(
            state["certification_name"], state["major"], state["middle"], state["lesson"]
        ),
    )


async def _invoke_lesson_auditor(state: CertificationState) -> LessonAuditResult:
    return await invoke_agent(
        get_auditor_lesson_agent(),
        build_lesson_audit_prompt(
            state["certification_name"], state["curriculum"], state["lessons"]
        ),
    )


def _curriculum_outline(curriculum: dict) -> str:
    lines = []
    for major in _flatten_majors(curriculum):
        lines.append(f"- {major.get('name')}")
        for middle in major.get("middleCategories", []) or []:
            lines.append(f"  - {middle.get('name')}")
            for lesson in middle.get("lessons", []) or []:
                lines.append(f"    - {lesson.get('name')}")
    return "\n".join(lines)


async def generate_diagnostic_exam_node(state: CertificationState):
    scope = f"Diagnostic exam for {state['certification_name']}"
    context = _curriculum_outline(state["curriculum"])
    batch = await invoke_question_agent(
        scope, context,
        f"Generate exactly {DIAGNOSTIC_EXAM_QUESTION_COUNT} questions sampling every major "
        "category, to gauge a new learner's starting knowledge before they begin studying. "
        "Favor EASY and AVERAGE difficulty. Mix MCQ, SHORT_ANSWER, and DESCRIPTIVE types.",
    )
    return {
        "diagnostic_exam": {"questions": questions_as_dicts(batch)},
        "status": "DIAGNOSTIC_EXAM_CREATED",
    }


def await_diagnostic_exam_review_node(state: CertificationState):
    decision = interrupt({
        "stage": "DIAGNOSTIC_EXAM",
        "payload": state.get("diagnostic_exam", {}),
    })
    return {"review_decision": decision, "status": "DIAGNOSTIC_EXAM_REVIEWED"}


async def generate_mock_exam_node(state: CertificationState):
    scope = f"Mock exam for {state['certification_name']}"
    context = _curriculum_outline(state["curriculum"])
    batch = await invoke_question_agent(
        scope, context,
        f"Generate exactly {MOCK_EXAM_QUESTION_COUNT} questions covering the entire curriculum "
        "proportionally to its size, simulating the real certification exam's difficulty and "
        "type distribution. Mix MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, and DIAGRAM types "
        "where relevant.",
    )
    return {
        "mock_exam": {"questions": questions_as_dicts(batch)},
        "status": "MOCK_EXAM_CREATED",
    }


def await_mock_exam_review_node(state: CertificationState):
    decision = interrupt({
        "stage": "MOCK_EXAM",
        "payload": state.get("mock_exam", {}),
    })
    return {"review_decision": decision, "status": "MOCK_EXAM_REVIEWED"}


async def generate_question_bank_node(state: CertificationState):
    scope = f"Adaptive learning question bank for {state['certification_name']}"
    context = _curriculum_outline(state["curriculum"])
    batch = await invoke_question_agent(
        scope, context,
        f"Generate exactly {QUESTION_BANK_QUESTION_COUNT} questions distributed across every "
        "major category and all supported types (MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, "
        "DIAGRAM), spanning EASY, AVERAGE, and DIFFICULT. This bank is the primary source for "
        "future adaptive assessments, remediation, and practice, so cover the curriculum "
        "broadly rather than deeply on any one topic.",
    )
    return {
        "question_bank": questions_as_dicts(batch),
        "status": "QUESTION_BANK_CREATED",
    }


def await_question_bank_review_node(state: CertificationState):
    decision = interrupt({
        "stage": "QUESTION_BANK",
        "payload": state.get("question_bank", []),
    })
    return {"review_decision": decision, "status": "QUESTION_BANK_REVIEWED"}


# ==========================================================================
# Per-item review loop nodes (Phase 2b step 12)
#
# One item at a time, so an admin can approve category 1 and reject category
# 2. Categories generate only a quiz -- per Q2 they are organizational and
# carry no instructional content; only lessons are authored.
# ==========================================================================

from app.domain.validation import validate_lesson, validate_question_batch  # noqa: E402
from app.graphs.certification.review_loop import (  # noqa: E402
    LoopPhase,
    current_index,
    current_item,
    record_version,
    source_for_decision,
)

MAJOR_PHASE = LoopPhase(
    scope="MAJOR",
    cursor_key="major_cursor",
    items_of=lambda curriculum: _flatten_majors(curriculum),
    label_of=lambda major: (major or {}).get("name", ""),
)

MIDDLE_PHASE = LoopPhase(
    scope="MIDDLE",
    cursor_key="middle_cursor",
    items_of=lambda curriculum: [m for _, m in _flatten_middles(curriculum)],
    label_of=lambda middle: (middle or {}).get("name", ""),
)


def _flatten_lessons(curriculum: dict) -> list[dict]:
    return [
        lesson
        for major in _flatten_majors(curriculum)
        for middle in (major.get("middleCategories") or [])
        for lesson in (middle.get("lessons") or [])
    ]


def _lesson_parents(curriculum: dict, index: int) -> tuple[dict, dict]:
    """The major/middle a lesson belongs to -- needed for the generation
    prompt and for labelling the persisted lesson."""
    position = 0
    for major in _flatten_majors(curriculum):
        for middle in major.get("middleCategories") or []:
            for _ in middle.get("lessons") or []:
                if position == index:
                    return major, middle
                position += 1
    return {}, {}


LESSON_PHASE = LoopPhase(
    scope="LESSON",
    cursor_key="lesson_cursor",
    items_of=_flatten_lessons,
    label_of=lambda lesson: (lesson or {}).get("name", ""),
)


async def major_generate_node(state: CertificationState):
    """Quiz for the current major category. No content node: categories are
    organizational (Q2)."""
    major = current_item(state, MAJOR_PHASE) or {}
    batch = await invoke_question_agent(
        f"Major category quiz for '{major.get('name')}' within {state['certification_name']}",
        major.get("description", ""),
        _with_improvement(
            state,
            f"Generate exactly {MAJOR_QUIZ_QUESTION_COUNT} questions covering every middle "
            "category under this major category, mixing MCQ, SHORT_ANSWER, and DESCRIPTIVE "
            "types. Set lesson_ref on each question to the lesson it tests.",
        ),
    )
    return {
        "major_quizzes": [
            {"majorCategory": major.get("name"), "questions": questions_as_dicts(batch)}
        ]
    }


async def middle_generate_node(state: CertificationState):
    middle = current_item(state, MIDDLE_PHASE) or {}
    pairs = _flatten_middles(state.get("curriculum", {}) or {})
    index = current_index(state, MIDDLE_PHASE)
    major = pairs[index][0] if index < len(pairs) else {}

    batch = await invoke_question_agent(
        f"Middle category quiz for '{middle.get('name')}' "
        f"(under major category '{major.get('name')}') within {state['certification_name']}",
        middle.get("description", ""),
        _with_improvement(
            state,
            f"Generate exactly {MIDDLE_QUIZ_QUESTION_COUNT} questions covering every lesson "
            "under this middle category, mixing MCQ, SHORT_ANSWER, and DESCRIPTIVE types. "
            "Set lesson_ref on each question to the lesson it tests.",
        ),
    )
    return {
        "middle_quizzes": [
            {
                "majorCategory": major.get("name"),
                "middleCategory": middle.get("name"),
                "questions": questions_as_dicts(batch),
            }
        ]
    }


async def lesson_content_node(state: CertificationState):
    """Authors the current lesson. Unlike categories, lessons carry the
    instructional content, so this runs before the quiz."""
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, LESSON_PHASE)
    lesson = current_item(state, LESSON_PHASE) or {}
    major, middle = _lesson_parents(curriculum, index)

    scoped = {**state, "major": major, "middle": middle, "lesson": lesson}
    feedback = state.get("review_instructions")
    if feedback:
        scoped = {
            **scoped,
            "lesson": {
                **lesson,
                "lessonGenerationInstructions": (
                    f"{lesson.get('lessonGenerationInstructions', '')}\n\n"
                    f"Reviewer feedback on the previous version -- apply it: {feedback}"
                ),
            },
        }
    result = await _invoke_lesson_agent(scoped)

    return {
        "lessons": [
            {
                "name": lesson.get("name"),
                "majorCategory": major.get("name"),
                "middleCategory": middle.get("name"),
                "title": result.title,
                "introduction": result.introduction,
                "learning_objectives": result.learning_objectives,
                "estimated_minutes": result.estimated_minutes,
                "sections": result.sections,
                "key_terms": [term.model_dump() for term in result.key_terms],
                "summary": result.summary,
                "blocks": lesson_to_blocks(result),
            }
        ]
    }


async def lesson_quiz_generate_node(state: CertificationState):
    index = current_index(state, LESSON_PHASE)
    generated = (state.get("lessons") or [])
    lesson = generated[index] if index < len(generated) else {}
    name = lesson.get("name") or (current_item(state, LESSON_PHASE) or {}).get("name", "")

    context = "\n".join(str(section) for section in (lesson.get("sections") or []))[:8000]
    batch = await invoke_question_agent(
        f"Lesson quiz for '{name}' within {state['certification_name']}",
        context,
        _with_improvement(
            state,
            f"Generate exactly {LESSON_QUIZ_QUESTION_COUNT} questions that test this lesson's "
            f"content directly, mixing MCQ and SHORT_ANSWER types. Set lesson_ref to '{name}'.",
        ),
    )
    return {"lesson_quizzes": [{"lesson": name, "questions": questions_as_dicts(batch)}]}


def _with_improvement(state: CertificationState, instructions: str) -> str:
    """Appends the reviewer's guidance to a generation instruction.

    This is the only thing separating "Improve with AI" from "Regenerate" --
    without it the admin's feedback would be collected and then ignored.
    """
    feedback = state.get("review_instructions")
    if not feedback:
        return instructions
    return (
        f"{instructions}\n\nThe reviewer rejected the previous version with this "
        f"feedback -- apply it: {feedback}"
    )


def _validate_latest_quiz(items: list[dict] | None, index: int, expected: int) -> dict:
    entry = (items or [])[index] if items and index < len(items) else None
    questions = (entry or {}).get("questions") or []
    return validate_question_batch(questions, expected_count=expected).model_dump(mode="json")


def major_validate_node(state: CertificationState):
    index = current_index(state, MAJOR_PHASE)
    artifact = _nth_entry(state.get("major_quizzes"), index)
    return {
        "validation_report": _validate_latest_quiz(
            state.get("major_quizzes"), index, MAJOR_QUIZ_QUESTION_COUNT
        ),
        # Recorded here rather than in the generator: validation runs after
        # every generation, so one place covers first pass, regenerate, and
        # improve-with-AI alike.
        "version_refs": record_version(
            state, MAJOR_PHASE, artifact=artifact,
            source=source_for_decision(state),
            instructions=state.get("review_instructions"),
        ),
        "status": "MAJOR_VALIDATED",
    }


def middle_validate_node(state: CertificationState):
    index = current_index(state, MIDDLE_PHASE)
    artifact = _nth_entry(state.get("middle_quizzes"), index)
    return {
        "validation_report": _validate_latest_quiz(
            state.get("middle_quizzes"), index, MIDDLE_QUIZ_QUESTION_COUNT
        ),
        "version_refs": record_version(
            state, MIDDLE_PHASE, artifact=artifact,
            source=source_for_decision(state),
            instructions=state.get("review_instructions"),
        ),
        "status": "MIDDLE_VALIDATED",
    }


async def lesson_validate_node(state: CertificationState):
    """Validates the lesson *and* its quiz -- both are what the reviewer
    judges at this checkpoint.

    Three layers, deliberately different in kind: deterministic structural
    checks (free, instant), an LLM audit of curriculum alignment (the one
    thing only a model can judge), then the human review that follows.
    """
    index = current_index(state, LESSON_PHASE)
    generated = state.get("lessons") or []
    lesson = generated[index] if index < len(generated) else None

    lesson_report = validate_lesson(lesson) if lesson else None
    quiz_report = _validate_latest_quiz(
        state.get("lesson_quizzes"), index, LESSON_QUIZ_QUESTION_COUNT
    )

    # Scoped to this one lesson: auditing the whole set on every iteration
    # would re-judge already-approved lessons and grow cost quadratically.
    alignment = None
    if lesson is not None:
        audit = await _invoke_lesson_auditor({**state, "lessons": [lesson]})
        alignment = audit.model_dump()
        if not audit.passed:
            logger.warning(
                "Lesson '%s' failed curriculum alignment: %s",
                lesson.get("name"), audit.summary,
            )

    return {
        "validation_report": {
            "lesson": lesson_report.model_dump(mode="json") if lesson_report else None,
            "quiz": quiz_report,
            "alignment": alignment,
        },
        "version_refs": record_version(
            state, LESSON_PHASE,
            artifact={"lesson": lesson, "quiz": _nth_entry(state.get("lesson_quizzes"), index)},
            source=source_for_decision(state),
            instructions=state.get("review_instructions"),
        ),
        "status": "LESSON_VALIDATED",
    }


def _nth_entry(items: list | None, index: int):
    items = items or []
    return items[index] if index < len(items) else None


# --- applying a reviewer's manual edit -----------------------------------
# Each phase writes its artifact to a different state key, so the loop is
# told how to apply an edit rather than guessing.

def apply_major_edit(state: CertificationState, payload) -> dict:
    major = current_item(state, MAJOR_PHASE) or {}
    return {"major_quizzes": [{"majorCategory": major.get("name"), "questions": payload}]}


def apply_middle_edit(state: CertificationState, payload) -> dict:
    pairs = _flatten_middles(state.get("curriculum", {}) or {})
    index = current_index(state, MIDDLE_PHASE)
    major, middle = pairs[index] if index < len(pairs) else ({}, {})
    return {
        "middle_quizzes": [
            {
                "majorCategory": major.get("name"),
                "middleCategory": middle.get("name"),
                "questions": payload,
            }
        ]
    }


def apply_lesson_edit(state: CertificationState, payload) -> dict:
    """A lesson edit may replace the lesson, its quiz, or both."""
    index = current_index(state, LESSON_PHASE)
    generated = state.get("lessons") or []
    existing = generated[index] if index < len(generated) else {}
    name = existing.get("name") or (current_item(state, LESSON_PHASE) or {}).get("name")

    update: dict = {}
    if isinstance(payload, dict) and "lesson" in payload:
        update["lessons"] = [{**existing, **(payload.get("lesson") or {}), "name": name}]
    if isinstance(payload, dict) and "quiz" in payload:
        update["lesson_quizzes"] = [{"lesson": name, "questions": payload.get("quiz")}]
    if not update:
        update["lessons"] = [{**existing, **(payload if isinstance(payload, dict) else {}),
                              "name": name}]
    return update
