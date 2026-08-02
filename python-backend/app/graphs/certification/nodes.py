import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

from app.core.config import get_settings
from app.schemas.certification.curriculum_schema import Curriculum
from app.schemas.certification.lesson_audit import LessonAuditResult
from app.schemas.certification.lesson_schema import GeneratedLesson
from .state import CertificationState
from app.ai.invocation import (
    invoke_agent,
    invoke_json_agent,
    invoke_question_agent,
    questions_as_dicts,
)
from app.domain.lesson_blocks import lesson_to_blocks
from app.domain.lesson_media import resolve_media
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
#
# Read from settings at call time rather than bound at import, so the same
# value reaches the generation prompt and the expected-count check in
# `_validate_latest_quiz` -- asking for 5 and then validating against 10 would
# report every quiz as short. Configurable because assessments dominate a run's
# token cost (280 questions at the defaults, whatever the curriculum's size),
# so they are what has to come down when the AI budget is the constraint.
def lesson_quiz_count() -> int:
    return get_settings().lesson_quiz_questions


def middle_quiz_count() -> int:
    return get_settings().middle_quiz_questions


def major_quiz_count() -> int:
    return get_settings().major_quiz_questions


def diagnostic_exam_count() -> int:
    return get_settings().diagnostic_exam_questions


def mock_exam_count() -> int:
    return get_settings().mock_exam_questions


def question_bank_count() -> int:
    return get_settings().question_bank_questions


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
        get_auditor_agent,
        build_document_audit_prompt(
            state["certification_name"], state["certification_description"], combined_samples
        ),
        agent_type="classification",
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


async def _invoke_curriculum_agent(state: CertificationState, context: str) -> Curriculum:
    # `invoke_json_agent`, not `invoke_agent`: the planner answers in plain
    # JSON so a sample that stops before its closing brackets is repaired here
    # rather than rejected by Groq as `tool_use_failed`. See
    # `app.agents.certification.curriculum_agent`.
    return await invoke_json_agent(
        get_curriculum_agent,
        build_curriculum_prompt(
            state["certification_name"], state["certification_description"], context
        ),
        Curriculum,
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
            "curriculum": curriculum.model_dump(by_alias=True),
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
        get_lesson_generation_agent,
        build_lesson_prompt(
            state["certification_name"], state["major"], state["middle"], state["lesson"]
        ),
    )


async def _invoke_lesson_auditor(state: CertificationState) -> LessonAuditResult:
    return await invoke_agent(
        get_auditor_lesson_agent,
        build_lesson_audit_prompt(
            state["certification_name"], state["curriculum"], state["lessons"]
        ),
        agent_type="classification",
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
    """Placed after the lessons, not before, so it can sample what the
    certification actually teaches rather than the outline's category names."""
    scope = f"Diagnostic exam for {state['certification_name']}"
    curriculum = state.get("curriculum", {}) or {}
    context = _content_for_lessons(state, _flatten_lessons(curriculum)) or _curriculum_outline(
        curriculum
    )
    batch = await invoke_question_agent(
        scope, context,
        f"Generate exactly {diagnostic_exam_count()} MCQ questions covering every lesson "
        "in the certification, to gauge a new learner's starting knowledge before they "
        "begin studying. Use MCQ only -- this exam is auto-scored before any teaching has "
        "happened. Favor EASY and AVERAGE difficulty. Set lesson_ref on each question to "
        "the lesson it tests.",
        count=diagnostic_exam_count(),
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


def _exam_structure(state: CertificationState) -> dict:
    return (state.get("curriculum", {}) or {}).get("exam_structure") or {}


#: What the mock exam falls back to when the planner could not determine the
#: real paper's shape. MCQ only, deliberately: every other type needs semantic
#: or manual grading, and guessing that an unknown exam contains programming or
#: diagramming tasks produces an exam that is both wrong and expensive to mark.
#: MCQ is the one format every certification uses and the only one that grades
#: itself, so it is the safe default -- breadth over the whole syllabus rather
#: than a guess at the paper's format.
UNKNOWN_EXAM_QUESTION_TYPES = "MCQ"


def exam_structure_is_known(state: CertificationState) -> bool:
    structure = _exam_structure(state)
    return bool(structure.get("total_items") or structure.get("question_types"))


def mock_exam_count_for(state: CertificationState) -> int:
    """The real exam's item count when the planner found it, else the
    configured fallback (`mock_exam_questions`, 50). Certifications differ far
    too much for one number to be right for all of them, which is why the
    planner researches it in the first place."""
    planned = int(_exam_structure(state).get("total_items") or 0)
    count = planned if planned > 0 else mock_exam_count()
    ceiling = get_settings().mock_exam_max_questions
    return min(count, ceiling) if ceiling > 0 else count


async def generate_mock_exam_node(state: CertificationState):
    """Imitates the *real* exam, using the structure the planner researched.

    A mock exam that ignores the paper it is imitating is not a mock exam:
    TOPCIT mixes MCQ, short-answer, descriptive, programming and diagramming
    across 100 items, while many certifications are MCQ-only.

    When the planner could not find the real paper's shape, this falls back to
    a straightforward 50-question MCQ exam covering the whole syllabus -- see
    `UNKNOWN_EXAM_QUESTION_TYPES`.
    """
    scope = f"Mock exam for {state['certification_name']}"
    curriculum = state.get("curriculum", {}) or {}
    structure = _exam_structure(state)
    count = mock_exam_count_for(state)
    known = exam_structure_is_known(state)

    types = ", ".join(structure.get("question_types") or []) or UNKNOWN_EXAM_QUESTION_TYPES
    notes = structure.get("notes") or ""

    context = _content_for_lessons(state, _flatten_lessons(curriculum)) or _curriculum_outline(
        curriculum
    )
    if notes:
        context = f"Real exam structure:\n{notes}\n\n{context}"

    if not known:
        logger.info(
            "No researched exam structure for '%s'; generating a %d-question MCQ mock exam "
            "across the whole curriculum",
            state["certification_name"], count,
        )

    coverage = (
        "covering every lesson in the certification proportionally"
        if known
        else "covering EVERY lesson in the certification, spread evenly so no lesson is "
        "left out and none dominates"
    )
    difficulty = (
        " and simulating the real exam's difficulty"
        if known
        else ". Mix EASY, AVERAGE and DIFFICULT items"
    )

    batch = await invoke_question_agent(
        scope, context,
        f"Generate exactly {count} questions {coverage}, drawn from the lesson content "
        f"above{difficulty}. This exam uses these question types ONLY: {types}. "
        "Do not use a type that is not listed. Set lesson_ref on each question to the "
        "lesson it tests.",
        count=count,
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
        f"Generate exactly {question_bank_count()} questions distributed across every "
        "major category and all supported types (MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, "
        "DIAGRAM), spanning EASY, AVERAGE, and DIFFICULT. This bank is the primary source for "
        "future adaptive assessments, remediation, and practice, so cover the curriculum "
        "broadly rather than deeply on any one topic.",
        count=question_bank_count(),
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


# --- nested traversal ------------------------------------------------------
#
# The walk is bottom-up and interleaved:
#
#     for each major:
#         for each middle:
#             for each lesson:  content -> 10-question quiz
#             middle quiz, from those lessons' content
#         major quiz, from every lesson under the major
#     mock exam -> diagnostic exam -> question bank
#
# It used to be three independent passes (all majors, then all middles, then
# all lessons), which meant every category quiz was written before a single
# lesson existed and had nothing to draw on but the category's one-line
# description. The predicates below are what curve the three flat loops into
# this nested one; see `register_phase`'s `in_scope` and `advance_router`.


def _lesson_belongs_to_current_middle(state: CertificationState) -> bool:
    """True while the lesson cursor is still inside the middle category whose
    quiz comes next. False ends the lesson run so that quiz can be written."""
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, LESSON_PHASE)
    return _middle_index_of_lesson(curriculum, index) == current_index(state, MIDDLE_PHASE)


def route_after_middle_advance(state: CertificationState) -> str:
    """Back to the lessons of the next middle category, or up to this major's
    own quiz once its last middle category is done."""
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, MIDDLE_PHASE)
    middles = MIDDLE_PHASE.items_of(curriculum)
    if index < len(middles) and _major_index_of_middle(curriculum, index) == current_index(
        state, MAJOR_PHASE
    ):
        return "lessons"
    return "major"


def route_after_major_advance(state: CertificationState) -> str:
    """Down into the next major category's lessons, or on to the exams."""
    curriculum = state.get("curriculum", {}) or {}
    if current_index(state, MAJOR_PHASE) < len(MAJOR_PHASE.items_of(curriculum)):
        return "lessons"
    return "exams"


# --- lesson content as quiz context ---------------------------------------
#
# Category quizzes are generated *after* the lessons beneath them, and are
# built from what those lessons actually say rather than from the category's
# one-line description. Previously a 50-question major quiz was written from
# `major["description"]` -- a single sentence -- so it tested the category's
# title rather than its teaching, and could ask about material no lesson
# covered. The graph order in `workflow.py` exists to make this possible.

#: Per-lesson and total ceilings on assembled quiz context. A major category
#: can hold 20 lessons; sending all of them whole would exceed the model's
#: rate limit outright (see `router.RequestTooLarge`).
_LESSON_CONTEXT_CHARS = 2500
_QUIZ_CONTEXT_CHARS = 20000


def _lesson_text(lesson: dict) -> str:
    """One generated lesson flattened to plain text for a quiz prompt."""
    parts = [lesson.get("title") or lesson.get("name") or "", lesson.get("introduction") or ""]
    for block in lesson.get("sections") or []:
        data = block.get("data", {}) if isinstance(block, dict) else {}
        for value in data.values():
            if isinstance(value, str):
                parts.append(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        parts.extend(v for v in item.values() if isinstance(v, str))
    parts.append(lesson.get("summary") or "")
    return "\n".join(part for part in parts if part)[:_LESSON_CONTEXT_CHARS]


def _generated_by_name(state: CertificationState) -> dict[str, dict]:
    return {
        lesson.get("name"): lesson
        for lesson in (state.get("lessons") or [])
        if isinstance(lesson, dict) and lesson.get("name")
    }


def _content_for_lessons(state: CertificationState, planned: list[dict]) -> str:
    """Assembled text of every *generated* lesson among `planned`.

    Skips planned lessons with no generated body -- one the reviewer rejected,
    or one still unwritten -- so a quiz is never asked to test content that
    does not exist.
    """
    generated = _generated_by_name(state)
    blocks = []
    for lesson in planned:
        body = generated.get((lesson or {}).get("name"))
        if body:
            blocks.append(f"### Lesson: {body.get('name')}\n{_lesson_text(body)}")
    return "\n\n".join(blocks)[:_QUIZ_CONTEXT_CHARS]


def _middle_at(curriculum: dict, index: int) -> tuple[dict, dict]:
    """The (major, middle) pair at a flat middle index."""
    pairs = _flatten_middles(curriculum)
    return pairs[index] if index < len(pairs) else ({}, {})


def _lessons_under_major(curriculum: dict, index: int) -> list[dict]:
    majors = _flatten_majors(curriculum)
    if index >= len(majors):
        return []
    return [
        lesson
        for middle in (majors[index].get("middleCategories") or [])
        for lesson in (middle.get("lessons") or [])
    ]


def _middle_index_of_lesson(curriculum: dict, lesson_index: int) -> int:
    """Flat middle index owning the lesson at `lesson_index`, or -1 past the
    end. This is what lets the lesson loop stop at a middle-category boundary
    instead of running through the whole certification."""
    position = 0
    for middle_index, (_, middle) in enumerate(_flatten_middles(curriculum)):
        for _ in middle.get("lessons") or []:
            if position == lesson_index:
                return middle_index
            position += 1
    return -1


def _major_index_of_middle(curriculum: dict, middle_index: int) -> int:
    position = 0
    for major_index, major in enumerate(_flatten_majors(curriculum)):
        for _ in major.get("middleCategories") or []:
            if position == middle_index:
                return major_index
            position += 1
    return -1


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
    in_scope=lambda state: _lesson_belongs_to_current_middle(state),
)


async def major_generate_node(state: CertificationState):
    """Quiz for the current major category, built from the lessons beneath it.

    No content node: categories are organizational (Q2). Runs only after every
    lesson under this major has been written, so `_content_for_lessons` has
    real material to draw on.
    """
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, MAJOR_PHASE)
    major = current_item(state, MAJOR_PHASE) or {}
    context = _content_for_lessons(state, _lessons_under_major(curriculum, index))

    batch = await invoke_question_agent(
        f"Major category quiz for '{major.get('name')}' within {state['certification_name']}",
        context or major.get("description", ""),
        _with_improvement(
            state,
            f"Generate exactly {major_quiz_count()} questions drawn from the lesson "
            "content above, covering every middle category under this major category "
            "proportionally. Test only material the lessons actually teach. Mix MCQ, "
            "SHORT_ANSWER, and DESCRIPTIVE types. Set lesson_ref on each question to "
            "the lesson it tests.",
        ),
        count=major_quiz_count(),
    )
    return {
        "major_quizzes": [
            {"majorCategory": major.get("name"), "questions": questions_as_dicts(batch)}
        ]
    }


async def middle_generate_node(state: CertificationState):
    """Quiz for the current middle category, built from its lessons' content.

    Runs immediately after the last lesson under this middle category, so the
    reviewer judges the quiz against material they have just seen.
    """
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, MIDDLE_PHASE)
    major, middle = _middle_at(curriculum, index)
    context = _content_for_lessons(state, middle.get("lessons") or [])

    batch = await invoke_question_agent(
        f"Middle category quiz for '{middle.get('name')}' "
        f"(under major category '{major.get('name')}') within {state['certification_name']}",
        context or middle.get("description", ""),
        _with_improvement(
            state,
            f"Generate exactly {middle_quiz_count()} questions drawn from the lesson "
            "content above, covering every lesson under this middle category. Test only "
            "material the lessons actually teach. Mix MCQ, SHORT_ANSWER, and DESCRIPTIVE "
            "types. Set lesson_ref on each question to the lesson it tests.",
        ),
        count=middle_quiz_count(),
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
        # `build_lesson_prompt` renders this as its own section; it used to be
        # concatenated onto the lesson's generation instructions, which put
        # reviewer prose inside a field describing the lesson's own content.
        scoped = {**scoped, "lesson": {**lesson, "review_feedback": feedback}}
    result = await _invoke_lesson_agent(scoped)

    # The model states what each picture should show; the searches run here,
    # off the event loop, where a failed lookup costs an illustration rather
    # than the lesson. See `app.domain.lesson_media`.
    result.sections = await asyncio.to_thread(resolve_media, result.sections)

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
            f"Generate exactly {lesson_quiz_count()} questions that test this lesson's "
            f"content directly, mixing MCQ and SHORT_ANSWER types. Set lesson_ref to '{name}'.",
        ),
        count=lesson_quiz_count(),
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
            state.get("major_quizzes"), index, major_quiz_count()
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
            state.get("middle_quizzes"), index, middle_quiz_count()
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
        state.get("lesson_quizzes"), index, lesson_quiz_count()
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
