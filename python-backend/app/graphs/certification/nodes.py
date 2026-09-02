import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

from app.core.config import get_settings
from app.schemas.certification.curriculum_schema import Curriculum
from app.schemas.certification.lesson_audit import LessonAuditResult
from app.schemas.certification.lesson_schema import GeneratedLesson
from .review_mode import auto_approving
from .state import CertificationState
from app.ai import tasks
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
from app.rag.retriever import retrieve_balanced_context, retrieve_context
from app.rag.store import add_documents, namespace_for
from app.rag.visuals import capture_document_visuals
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


#: The diagnostic is 40 items for every certification, deliberately fixed.
#:
#: It is not imitating the real paper -- the mock does that, at whatever length
#: the paper actually is. The diagnostic exists to place a learner across the
#: whole syllabus before they start, and that job wants the SAME length every
#: time: it is the baseline every later score is read against, and a baseline
#: whose length moves with the certification is not comparable between them.
#: Forty is long enough to touch every lesson of a real curriculum and short
#: enough to sit before studying anything.
#:
#: Layout still follows the real exam (see generate_diagnostic_exam_node) --
#: same question types, fixed count.
DIAGNOSTIC_EXAM_ITEMS = 40


def diagnostic_exam_count() -> int:
    """Deprecated: the diagnostic is fixed at DIAGNOSTIC_EXAM_ITEMS.

    Kept so `diagnostic_exam_questions` in config/.env stops silently changing
    a length that is meant to be constant across certifications.
    """
    return DIAGNOSTIC_EXAM_ITEMS


def mock_exam_count() -> int:
    return get_settings().mock_exam_questions


def question_bank_count(curriculum: dict | None = None) -> int:
    """How many bank questions to author.

    Per-lesson when `question_bank_questions_per_lesson` is set, so every
    lesson gets its own pool rather than sharing one flat certification-wide
    bank -- see that setting for why the per-lesson readers need it. Falls back
    to the flat total when the curriculum is unavailable, so a caller without
    state still gets a sane number instead of zero.
    """
    settings = get_settings()
    per_lesson = settings.question_bank_questions_per_lesson
    lessons = len(_flatten_lessons(curriculum or {}))

    if per_lesson <= 0:
        # The flat total, but never fewer questions than there are lessons.
        #
        # The bank is what adaptive learning draws on, and mastery is tracked
        # PER LESSON: a lesson with no bank question of its own can never be
        # practised, retaken or measured, so the learner's mastery of it stays
        # unknown forever. A flat 100 across 75 lessons is fine; the same 100
        # across 140 would leave 40 lessons permanently invisible to BKT.
        #
        # Raising the floor keeps that impossible without anyone having to
        # notice the curriculum grew.
        return max(settings.question_bank_questions, lessons)

    if lessons <= 0:
        return settings.question_bank_questions

    return per_lesson * lessons


def _namespace(state: CertificationState) -> str:
    """Index key for this run. Scoping the index per certification is what
    stops one ingestion from overwriting another's vectors."""
    return namespace_for(
        certification_id=state.get("certification_id"),
        certification_name=state.get("certification_name", ""),
    )


async def capture_document_visuals_node(state: CertificationState):
    """Screenshots figures/diagrams/tables/charts out of the uploaded PDFs
    before ingestion drops the raw bytes, so a later lesson/question stage
    can attach the *original visual* to what it generates instead of only a
    text description of it (or a stock-photo search result -- see
    `app/domain/lesson_media.py`)."""
    logger.info("Document visual capture started")

    visuals = await asyncio.to_thread(
        capture_document_visuals,
        state.get("document_refs"),
        state.get("uploaded_files"),
        certification_id=state.get("certification_id"),
    )
    logger.info("Captured %d figures from source documents", len(visuals))

    return {"document_visuals": visuals}


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
        task=tasks.DOCUMENT_AUDIT,
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
    # rather than rejected upstream as `tool_use_failed`. See
    # `app.agents.certification.curriculum_agent`.
    # Adding to a certification rather than building one. Stated as part of the
    # context so it needs no second prompt template: the planner is told what
    # exists and asked for the difference, and everything downstream then works
    # on that difference alone.
    existing = (state.get("existing_curriculum") or "").strip()
    if existing:
        context = (
            "THIS CERTIFICATION ALREADY EXISTS AND YOU ARE ADDING TO IT.\n\n"
            "Already covered -- do NOT plan any of these again, and do not "
            "restate them in your answer:\n"
            f"{existing}\n\n"
            "Return ONLY the major categories, middle categories and lessons "
            "that the source material below adds to what is listed above. If a "
            "new lesson belongs under an existing major category, repeat that "
            "major category's name EXACTLY as written above and put only the "
            "new middle categories or lessons inside it -- matching is by name, "
            "so an exact repeat attaches to the existing one instead of "
            "creating a duplicate. If the material adds nothing genuinely new, "
            "return an empty majorCategories list rather than inventing "
            "material to fill it.\n\n"
            f"{context}"
        )

    return await invoke_json_agent(
        get_curriculum_agent,
        build_curriculum_prompt(
            state["certification_name"], state["certification_description"], context
        ),
        Curriculum,
        task=tasks.CURRICULUM,
    )


async def curriculum_planning_agent_node(state: CertificationState):
    logger.info("Curriculum planning started")

    try:
        # No metadata filter: the index is already scoped to this
        # certification, so cross-certification bleed is impossible by
        # construction rather than by post-filtering.
        #
        # Balanced, not top-ranked. This is the one retrieval in the run whose
        # job is coverage rather than relevance -- it decides which domains
        # exist at all, and a document it does not see becomes a domain the
        # certification does not have. Plain top-k let one file take every
        # slot: six TOPCIT documents, one per domain, produced a three-major
        # curriculum because only three files survived the ranking.
        context = await asyncio.to_thread(
            retrieve_balanced_context,
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


def _stage_questions(payload) -> list:
    """The question list inside a whole-artifact payload.

    The bank is a bare list; the mock and diagnostic wrap theirs in
    `{"questions": [...]}`.
    """
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        items = payload.get("questions")
        if isinstance(items, list):
            return items
    return []


def _stage_quality_retry(state: CertificationState, stage: str, payload, expected):
    """The per-item loop's quality gate, for the whole-artifact stages.

    These three had no validate node at all: the mock exam, the diagnostic and
    the question bank generated straight into an auto-approval, so the bank --
    the largest single batch of questions a run produces, and the pool every
    adaptive feature later draws on -- was the least checked artifact in the
    build. Scoring it here costs nothing (the checks are pure functions over
    the batch) and gives the same one-shot regeneration the lesson and category
    quizzes get.

    Once per stage, and only on an unattended run. Regenerating the bank is ~25
    model calls, so a second failing score is accepted rather than paid for
    twice.
    """
    threshold = get_settings().auto_review_min_quality_score
    if threshold <= 0:
        return None

    key = f"{stage}:0"
    if key in (state.get("quality_retried") or []):
        return None

    questions = _stage_questions(payload)
    if not questions:
        return None

    report = validate_question_batch(questions, expected_count=expected)
    if report.score >= threshold:
        return None

    logger.info(
        "%s scored %d, below the %d quality gate -- regenerating once with "
        "the validator's findings",
        stage, report.score, threshold,
    )
    return {
        "review_decision": "regenerate",
        "status": f"{stage}_AUTO_IMPROVING",
        "validation_report": report.model_dump(mode="json"),
        "review_instructions": (
            f"The previous version scored {report.score}/100 on automated "
            "quality checks. Fix exactly these problems and keep everything "
            "else that was already correct:\n"
            + _quality_feedback([report.model_dump(mode="json")])
        ),
        "quality_retried": [*(state.get("quality_retried") or []), key],
    }


def _await_review(
    state: CertificationState, stage: str, payload, *, expected: int | None = None
) -> dict:
    """One whole-artifact HITL checkpoint.

    An unattended run (`review_mode == "AUTO"`) approves without pausing: the
    interrupt is never raised, rather than raised and immediately resumed, so
    the run reaches the end with nobody watching it.

    The decision is reduced to its action string here. A reviewer's decision
    arrives over HTTP as `{"action": ..., "instructions": ...}`, and storing
    that dict whole is why `route_after_review` -- which compares against the
    string `"regenerate"` -- could never route a regenerate at these four
    stages: the comparison was dict-against-string and silently approved.
    """
    if auto_approving(state):
        retry = _stage_quality_retry(state, stage, payload, expected)
        if retry is not None:
            return retry
        logger.info("Auto-approving %s: run is unattended", stage)
        return {"review_decision": "approve", "status": f"{stage}_AUTO_APPROVED"}

    decision = interrupt({"stage": stage, "payload": payload})
    action = decision if isinstance(decision, str) else (decision or {}).get("action", "approve")
    return {"review_decision": action, "status": f"{stage}_REVIEWED"}


def await_curriculum_review_node(state: CertificationState):
    """HITL checkpoint: pauses after the curriculum is planned, before any
    quizzes/lessons are generated from it, so an admin can review the
    structure. Resume with Command(resume="approve") or
    Command(resume="regenerate")."""
    return _await_review(state, "CURRICULUM", state["curriculum"])


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
        task=tasks.LESSON,
    )


async def _invoke_lesson_auditor(state: CertificationState) -> LessonAuditResult:
    return await invoke_agent(
        get_auditor_lesson_agent,
        build_lesson_audit_prompt(
            state["certification_name"], state["curriculum"], state["lessons"]
        ),
        task=tasks.LESSON_AUDIT,
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
    # The real paper's shape, same source the mock reads. The diagnostic is the
    # mock's layout at a fixed length: a learner should meet the exam's formats
    # here, before studying, rather than for the first time at the end.
    context = _with_exam_structure(context, state)

    batch = await invoke_question_agent(
        scope, context,
        _with_improvement(
            state,
            f"Generate exactly {DIAGNOSTIC_EXAM_ITEMS} questions covering every lesson "
            "in the certification, to gauge a new learner's starting knowledge before they "
            "begin studying. Use the same question types and layout as the real exam "
            f"described above: {researched_question_types(state, UNKNOWN_EXAM_QUESTION_TYPES)}."
            f"{performance_quota(researched_question_types(state, UNKNOWN_EXAM_QUESTION_TYPES), DIAGNOSTIC_EXAM_ITEMS)}"
            f"{SUB_QUESTION_RULE} "
            "Favor EASY and AVERAGE difficulty -- this is sat before any teaching has "
            "happened. Set lesson_ref on each question to the lesson it tests.",
        ),
        count=DIAGNOSTIC_EXAM_ITEMS,
        existing_stems=written_stems(state),
    )
    return {
        "diagnostic_exam": {"questions": questions_as_dicts(batch)},
        "status": "DIAGNOSTIC_EXAM_CREATED",
    }


def await_diagnostic_exam_review_node(state: CertificationState):
    return _await_review(
        state, "DIAGNOSTIC_EXAM", state.get("diagnostic_exam", {}),
        expected=DIAGNOSTIC_EXAM_ITEMS,
    )


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


def _with_exam_structure(context: str, state: CertificationState) -> str:
    """Prefixes the generation context with what the real exam looks like.

    The diagnostic, the mock and the question bank are all meant to reflect one
    paper, and each used to be written knowing only the syllabus. Coverage in
    particular matters and was not consulted anywhere: the weightings the
    certification body examines against are not always the weightings the
    curriculum teaches to, and a bank sampled from the syllabus alone
    over-tests whatever happened to have the most lessons.

    Returns the context unchanged when nothing was researched, so a
    certification whose paper could not be found is generated exactly as
    before rather than against an empty heading.
    """
    structure = _exam_structure(state)
    lines = []
    if structure.get("total_items"):
        lines.append(f"- Items in the real exam: {structure['total_items']}")
    if structure.get("question_types"):
        lines.append(f"- Question types: {', '.join(structure['question_types'])}")
    if structure.get("duration_minutes"):
        lines.append(f"- Time allowed: {structure['duration_minutes']} minutes")
    if structure.get("passing_score"):
        lines.append(f"- Pass mark: {structure['passing_score']}%")
    if structure.get("coverage"):
        lines.append(f"- Examined coverage and weighting:\n{structure['coverage']}")
    if structure.get("notes"):
        lines.append(f"- Other structure: {structure['notes']}")

    if not lines:
        return context

    return "Real exam structure:\n" + "\n".join(lines) + "\n\n" + context


#: What each checkbox in the create form means in generator terms.
#:
#: "Critical thinking" is one choice to an admin and two types to the
#: generator: a programming task and a diagramming task are both
#: CRITICAL_THINKING once stored (see `_WORKSPACE_TYPES` in
#: assessment_persistence), so the box that turns them on turns on both.
QUESTION_TYPE_CHOICES = {
    "MCQ": ["MCQ"],
    "SHORT_ANSWER": ["SHORT_ANSWER"],
    "DESCRIPTIVE": ["DESCRIPTIVE"],
    "CRITICAL_THINKING": ["PROGRAMMING", "DIAGRAM"],
}


def requested_question_types(state: CertificationState) -> str:
    """The admin's own choice of formats, when they made one.

    Expanded from the checkboxes on the create form. Empty when they left the
    question to the planner, which is the default.
    """
    chosen = state.get("requested_question_types") or []
    expanded: list[str] = []
    for choice in chosen:
        for question_type in QUESTION_TYPE_CHOICES.get(str(choice).upper(), []):
            if question_type not in expanded:
                expanded.append(question_type)
    return ", ".join(expanded)


def researched_question_types(state: CertificationState, default: str) -> str:
    """The certification's own question types, for any stage that generates items.

    The planner researches what the real paper actually contains and writes it
    to `exam_structure.question_types` -- for TOPCIT that is MCQ, short answer,
    descriptive, programming and diagramming. That research was then read in
    exactly one place, the mock exam, while every other stage asked for a
    hardcoded list. So a TOPCIT run produced 311 MCQ, 204 short answer, 158
    descriptive, 2 diagram and *zero* programming items: the run knew the
    certification had programming tasks and never asked for one outside the
    mock.

    Practising a format only in the final mock is the wrong way round -- the
    lesson quizzes and unit exams are where a learner should meet it first.

    `default` is the stage's own list, used when the planner could not
    determine the paper's shape. Unchanged behaviour for a certification whose
    structure is unknown; see UNKNOWN_EXAM_QUESTION_TYPES for why guessing is
    worse than defaulting.

    Precedence: the ADMIN'S choice, then the planner's research, then the
    stage's default. An admin who ticked the boxes has told us what this
    certification examines, and research that disagrees with them is research
    about a different exam than the one they are building -- so their answer
    wins outright rather than being merged with it.
    """
    chosen = requested_question_types(state)
    if chosen:
        return chosen

    types = _exam_structure(state).get("question_types") or []
    return ", ".join(types) if types else default


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

    context = _content_for_lessons(state, _flatten_lessons(curriculum)) or _curriculum_outline(
        curriculum
    )
    # The whole researched shape, not just the free-text notes: count, types,
    # time, pass mark and examined weighting. Coverage especially -- a mock
    # sampled from the syllabus rather than the paper's own weighting tests the
    # wrong proportions however good the individual items are.
    context = _with_exam_structure(context, state)

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
        else ". Mix EASY, AVERAGE and HARD items"
    )

    batch = await invoke_question_agent(
        scope, context,
        _with_improvement(
            state,
            f"Generate exactly {count} questions {coverage}, drawn from the lesson content "
            f"above{difficulty}. This exam uses these question types ONLY: {types}. "
            f"Do not use a type that is not listed.{performance_quota(types, count)}"
            f"{SUB_QUESTION_RULE} "
            "Set lesson_ref on each question to the lesson it tests.",
        ),
        count=count,
        existing_stems=written_stems(state),
    )
    return {
        "mock_exam": {"questions": questions_as_dicts(batch)},
        "status": "MOCK_EXAM_CREATED",
    }


def await_mock_exam_review_node(state: CertificationState):
    return _await_review(
        state, "MOCK_EXAM", state.get("mock_exam", {}), expected=mock_exam_count()
    )


#: Share of a paper that must be performance items when the exam uses them.
#:
#: Naming the permitted types is not enough and never was. "This exam uses
#: these question types ONLY: MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING" is
#: permission, and a model handed permission writes the cheap types: TOPCIT's
#: mock came back 24 MCQ, 21 descriptive, 20 short answer and ZERO programming,
#: from a list that allowed programming. The bank did the same -- 3 programming
#: and 1 diagram out of 72.
#:
#: A performance item is several paragraphs of scenario plus starter code or a
#: reference model, so left to its own judgement the model always has a reason
#: to write one fewer. The only thing that changes the outcome is a required
#: count, stated per type.
PERFORMANCE_ITEM_SHARE = 0.20

#: Types that need the quota above; the rest are cheap enough to write freely.
PERFORMANCE_TYPES = ("PROGRAMMING", "DIAGRAM")


def performance_quota(types: str, total: int) -> str:
    """A per-type minimum for the performance formats this exam uses.

    Returns "" when the exam uses none of them, so an MCQ-only certification
    is asked for nothing it does not examine.
    """
    wanted = [t for t in PERFORMANCE_TYPES if t in (types or "").upper()]
    if not wanted or total <= 0:
        return ""

    # At least one each -- a share that rounds to zero on a short paper would
    # reintroduce exactly the problem this exists to fix.
    each = max(1, round(total * PERFORMANCE_ITEM_SHARE / len(wanted)))
    parts = ", ".join(f"at least {each} {t}" for t in wanted)
    return (
        f" REQUIRED MINIMUMS, not suggestions: {parts}. These are the items the "
        "certification is actually testing for, and a paper without them does "
        "not resemble the real one. Write them first, before the multiple "
        "choice, so they are not what runs out of room at the end."
        + mcq_format_quota(types, total)
    )


#: Share of an exam's MCQs that must WORK something out rather than recall it.
MCQ_WORK_ITEM_SHARE = 0.25


def mcq_format_quota(types: str, total: int) -> str:
    """A minimum for the MCQ formats that require reasoning, not recall.

    The system prompt already describes COMBINATION (a pseudocode procedure
    with labelled blanks, each option fixing all of them at once) and TRACE AND
    COMPUTE items in full, with a worked example -- and `MCQ_MAX_CHOICES` was
    raised from four to nine specifically to make the combination format
    expressible.

    None were ever written. Across a whole generated certification every one of
    434 MCQs had exactly four choices, which is only possible if not a single
    combination item was attempted. The description was there and the model
    passed over it, the same way it passed over the curriculum's consolidation
    guidance until that was given a number.

    So this states a count. `performance_quota` above proved the pattern: a
    qualitative push is ignored, a required minimum is met.
    """
    if "MCQ" not in (types or "").upper() or total <= 0:
        return ""
    wanted = max(1, round(total * MCQ_WORK_ITEM_SHARE))
    return (
        f" Of the MCQs, at least {wanted} must be COMBINATION or TRACE AND "
        "COMPUTE items -- an artifact in the stem (pseudocode, a query, a "
        "config, a state table) that the learner has to run in their head, "
        "with distractors that are the results of specific plausible mistakes. "
        "A combination item uses more than four choices, one per full set of "
        "blank values. These carry the reasoning the paper is supposed to "
        "measure; a bank where every MCQ has four options and asks 'which of "
        "the following is X' is a vocabulary test."
    )


#: Multi-part items on the two whole-certification papers.
#:
#: The agent's system prompt already says performance items take sub-questions,
#: but neither the mock nor the diagnostic ever asked for them, and a general
#: rule competes with a specific instruction that does not mention it. These
#: are also the two papers where parts matter most: they imitate a real
#: examination, and a real examination's performance section is a scenario
#: followed by questions about it, not a lone prompt with a box.
SUB_QUESTION_RULE = (
    " Every PROGRAMMING and DIAGRAM item, and any DESCRIPTIVE item built on a "
    "scenario, MUST carry 2 to 4 entries in sub_questions -- the parts asked "
    "about the artifact or case, each with its own rubric_answer and points. "
    "That is how the real paper is structured and how these items are marked: "
    "an item with no parts is graded as one all-or-nothing answer."
)


def _lesson_performance_rule(state: CertificationState) -> str:
    """Requires a performance item when the LESSON itself teaches one.

    A fixed quota is right for a whole paper and wrong for a single lesson: a
    ten-question quiz on project governance should not be forced to contain a
    coding task. So this is conditional on the material rather than counted --
    the model has just written the lesson and knows whether it taught something
    you would assess by writing code or drawing a model.

    What it replaces is a quiz that tested a lesson on ER modelling with three
    multiple-choice questions about ER modelling. If the lesson taught the
    learner to DO something, the quiz has to ask them to do it.

    Empty when the certification does not examine these formats at all -- see
    `researched_question_types`.
    """
    available = researched_question_types(state, "MCQ, SHORT_ANSWER").upper()
    wanted = [t for t in PERFORMANCE_TYPES if t in available]
    if not wanted:
        return ""

    names = " or ".join(t for t in wanted)
    return (
        f"If this lesson teaches something a learner is meant to DO -- writing "
        f"code, or building a model, diagram or schema -- then at least one "
        f"question MUST be {names}, testing that skill by having them produce "
        f"it. A lesson that teaches a practical skill and is assessed only by "
        f"multiple choice has not been assessed. If the lesson is purely "
        f"conceptual, do not force one. "
    )


async def generate_question_bank_node(state: CertificationState):
    scope = f"Adaptive learning question bank for {state['certification_name']}"
    curriculum = state.get("curriculum", {}) or {}
    # The bank feeds practice, remediation and adaptive retakes, so what it
    # over- and under-samples is what a learner ends up drilling. Sampling the
    # syllabus alone drills whatever has the most lessons; the exam's own
    # weighting is the thing worth rehearsing against.
    context = _with_exam_structure(_curriculum_outline(curriculum), state)

    settings = get_settings()
    total = question_bank_count(curriculum)
    per_lesson = settings.question_bank_questions_per_lesson
    lessons = len(_flatten_lessons(curriculum))

    if per_lesson > 0 and lessons > 0:
        # Stated per lesson AND as a total. The per-lesson figure is what makes
        # the distribution even; the total is what stops the model stopping
        # early, which it does when given only a rate.
        spread = (
            f"Generate exactly {total} questions: {per_lesson} for EVERY ONE of the "
            f"{lessons} lessons in the curriculum, with none left without its own "
            "questions. Set lesson_ref on each question to the lesson it tests -- a "
            "question with no lesson_ref cannot be used by the per-lesson quizzes, "
            "the knowledge check, or mastery tracking, so it is wasted work. "
        )
    elif lessons > 0:
        # A flat pool still has to reach every lesson. Told only "distribute
        # across major categories", the model clusters on whatever it found
        # most to say about, and lessons at the tail of the syllabus get
        # nothing -- which the per-lesson readers then experience as a lesson
        # with no questions at all.
        spread = (
            f"Generate exactly {total} questions covering ALL {lessons} lessons "
            "in the curriculum. EVERY lesson must get at least one question "
            "before any lesson gets a second, then spread the remainder by how "
            "much material each lesson actually holds. Set lesson_ref on each "
            "question to the lesson it tests -- a question with no lesson_ref "
            "cannot be used by the per-lesson quizzes, the knowledge check, or "
            "mastery tracking, so it is wasted work. "
        )
    else:
        spread = (
            f"Generate exactly {total} questions distributed across every "
            "major category, setting lesson_ref on each question to the lesson it "
            "tests. "
        )

    # The bank practises what the exam examines, so it uses the certification's
    # own formats -- and is held to the same minimums as the mock. Left as "use
    # all supported types" it produced 3 programming items and 1 diagram out of
    # 72, which is not a bank a learner can practise those formats from.
    bank_types = researched_question_types(
        state, "MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, DIAGRAM"
    )

    batch = await invoke_question_agent(
        scope, context,
        _with_improvement(
            state,
            spread
            + f"Use these question types: {bank_types}, spanning EASY, AVERAGE, and HARD."
            + performance_quota(bank_types, total)
            + " This bank is the primary source for "
            "future adaptive assessments, remediation, and practice, so cover the curriculum "
            "broadly rather than deeply on any one topic.",
        ),
        count=total,
        existing_stems=written_stems(state),
    )
    return {
        "question_bank": questions_as_dicts(batch),
        "status": "QUESTION_BANK_CREATED",
    }


def await_question_bank_review_node(state: CertificationState):
    # No `expected` for the bank on purpose. Its total is dedupe-limited by
    # design -- each batch only sees the last 40 stems already written, so a
    # 500-question ask lands somewhat under -- and a COUNT_MISMATCH warning on
    # every single run would be noise the gate has to discount rather than
    # signal. The exams are the opposite: a mock exam of the wrong length is
    # not the exam it imitates.
    return _await_review(state, "QUESTION_BANK", state.get("question_bank", []))


# ==========================================================================
# Per-item review loop nodes (Phase 2b step 12)
#
# One item at a time, so an admin can approve category 1 and reject category
# 2. Categories generate only a quiz -- per Q2 they are organizational and
# carry no instructional content; only lessons are authored.
# ==========================================================================

from app.domain.validation import validate_lesson, validate_question_batch  # noqa: E402
from app.graphs.certification.review_loop import (  # noqa: E402
    _quality_feedback,
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


def _lesson_at(curriculum: dict, index: int) -> dict | None:
    """The lesson at a flat index, or None past the end."""
    lessons = _flatten_lessons(curriculum)
    return lessons[index] if 0 <= index < len(lessons) else None


def _lessons_left_in_parent(curriculum: dict, index: int) -> int:
    """How many lessons remain in the middle category holding `index`,
    counting that one.

    Read-ahead stops at this boundary. The walk leaves the lesson phase at the
    end of each middle category to write that category's exam, and what comes
    after is decided there -- so authoring past it would be writing lessons the
    run has not yet committed to reaching in that order.
    """
    position = 0
    for major in _flatten_majors(curriculum):
        for middle in major.get("middleCategories") or []:
            lessons = middle.get("lessons") or []
            if position <= index < position + len(lessons):
                return position + len(lessons) - index
            position += len(lessons)
    return 1


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
            "proportionally. Test only material the lessons actually teach. Use these "
            f"question types: "
            f"{researched_question_types(state, 'MCQ, SHORT_ANSWER, DESCRIPTIVE')}."
            f"{performance_quota(researched_question_types(state, 'MCQ, SHORT_ANSWER, DESCRIPTIVE'), major_quiz_count())} "
            "Set lesson_ref on each question to the lesson it tests.",
        ),
        count=major_quiz_count(),
        existing_stems=written_stems(state),
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
            "material the lessons actually teach. Use these question types: "
            f"{researched_question_types(state, 'MCQ, SHORT_ANSWER, DESCRIPTIVE')}."
            f"{performance_quota(researched_question_types(state, 'MCQ, SHORT_ANSWER, DESCRIPTIVE'), middle_quiz_count())} "
            "Set lesson_ref on each question to the lesson it tests.",
        ),
        count=middle_quiz_count(),
        existing_stems=written_stems(state),
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


async def _author_lesson(
    state: CertificationState,
    curriculum: dict,
    index: int,
    feedback: str = "",
) -> dict:
    """Writes ONE lesson and returns the record the walk stores.

    Split out of `lesson_content_node` so several can run at once; on its own
    it is exactly what that node always did for the current index.
    """
    lesson = _lesson_at(curriculum, index) or {}
    major, middle = _lesson_parents(curriculum, index)

    if feedback:
        # `build_lesson_prompt` renders this as its own section; it used to be
        # concatenated onto the lesson's generation instructions, which put
        # reviewer prose inside a field describing the lesson's own content.
        lesson = {**lesson, "review_feedback": feedback}

    scoped = {**state, "major": major, "middle": middle, "lesson": lesson}
    result = await _invoke_lesson_agent(scoped)

    # The model states what each picture should show; the searches run here,
    # off the event loop, where a failed lookup costs an illustration rather
    # than the lesson. See `app.domain.lesson_media`.
    result.sections = await asyncio.to_thread(resolve_media, result.sections)

    return {
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


async def _quiz_for(state: CertificationState, lesson: dict) -> dict:
    """The lesson's own quiz, built from the content just written for it."""
    name = lesson.get("name") or ""
    context = "\n".join(str(section) for section in (lesson.get("sections") or []))[:8000]
    batch = await invoke_question_agent(
        f"Lesson quiz for '{name}' within {state['certification_name']}",
        context,
        _with_improvement(
            state,
            f"Generate exactly {lesson_quiz_count()} questions that test this lesson's "
            f"content directly, using these question types: "
            f"{researched_question_types(state, 'MCQ, SHORT_ANSWER')}. "
            + _lesson_performance_rule(state)
            + f"Set lesson_ref to '{name}'.",
        ),
        count=lesson_quiz_count(),
        existing_stems=written_stems(state),
    )
    return {"lesson": name, "questions": questions_as_dicts(batch)}


async def _produce_lesson(state: CertificationState, curriculum: dict, index: int) -> dict:
    """Everything one lesson costs: its content, its quiz, and its audit.

    Run as a single task so several lessons can be in flight at once. The three
    calls are chained rather than concurrent because each needs the one before
    -- the quiz is written from the content, the audit judges it -- and there
    is nothing to gain from splitting them: the parallelism that matters is
    across lessons, not within one.
    """
    lesson = await _author_lesson(state, curriculum, index)
    quiz = await _quiz_for(state, lesson)

    audit = await _invoke_lesson_auditor({**state, "lessons": [lesson]})
    if not audit.passed:
        logger.warning(
            "Lesson '%s' failed curriculum alignment: %s",
            lesson.get("name"), audit.summary,
        )

    return {"lesson": lesson, "quiz": quiz, "audit": audit.model_dump()}


def _read_ahead_width(state: CertificationState) -> int:
    """How many lessons to author at once, or 1 to keep the old behaviour.

    Batching only on unattended runs, because a supervised reviewer can edit a
    lesson or send it back to be rewritten, and anything authored before they
    did that would be stale -- silently, since the walk cannot tell content it
    wrote ten minutes ago from content it wrote just now.
    """
    if not auto_approving(state):
        return 1
    return max(1, get_settings().lesson_concurrency)


async def lesson_content_node(state: CertificationState):
    """Authors the current lesson. Unlike categories, lessons carry the
    instructional content, so this runs before the quiz.

    Authoring is the slowest thing this graph does and nothing about it is
    ordered: lesson twelve does not read lesson eleven. So on an unattended run
    this writes the next few lessons at the same time and parks the extras in
    `lesson_content_ahead`, where later visits collect them without an AI call.
    The walk itself is unchanged -- it still arrives at one lesson at a time,
    and still reviews, checkpoints and advances exactly as before. It just
    finds most of them already written.
    """
    curriculum = state.get("curriculum", {}) or {}
    index = current_index(state, LESSON_PHASE)

    # Written on an earlier pass. Hand it over and drop it, so the state does
    # not carry finished lessons twice.
    content_ahead = dict(state.get("lesson_content_ahead") or {})
    if str(index) in content_ahead:
        logger.info("Lesson %s was written ahead; using it", index + 1)
        return {
            "lessons": [content_ahead.pop(str(index))],
            "lesson_content_ahead": content_ahead,
        }

    feedback = state.get("review_instructions")
    width = 1 if feedback else _read_ahead_width(state)

    # Never past the end of the phase, and never past the current parent: the
    # walk hands over to a middle category's exam at its boundary, and lessons
    # beyond it may be reviewed, edited or never reached.
    remaining = _lessons_left_in_parent(curriculum, index)
    width = max(1, min(width, remaining))

    if width == 1:
        return {"lessons": [await _author_lesson(state, curriculum, index, feedback)]}

    logger.info(
        "Producing lessons %s-%s concurrently (content, quiz and audit)",
        index + 1, index + width,
    )
    results = await asyncio.gather(
        *(_produce_lesson(state, curriculum, index + offset) for offset in range(width)),
        return_exceptions=True,
    )

    # The current lesson is the one the walk is waiting on, so a failure there
    # is raised and handled the way a single-lesson failure always was. A
    # failure further ahead is dropped instead: nothing is parked for it, and
    # the walk produces it normally when it arrives.
    if isinstance(results[0], BaseException):
        raise results[0]

    quiz_ahead = dict(state.get("lesson_quiz_ahead") or {})
    audit_ahead = dict(state.get("lesson_audit_ahead") or {})

    for offset, result in enumerate(results[1:], start=1):
        if isinstance(result, BaseException):
            logger.warning(
                "Read-ahead for lesson %s failed (%s); it will be written when reached",
                index + offset + 1, result,
            )
            continue
        key = str(index + offset)
        content_ahead[key] = result["lesson"]
        quiz_ahead[key] = result["quiz"]
        audit_ahead[key] = result["audit"]

    # This lesson's own quiz and audit are parked under its index too: the walk
    # is between nodes, and the quiz node runs next and collects it.
    quiz_ahead[str(index)] = results[0]["quiz"]
    audit_ahead[str(index)] = results[0]["audit"]

    return {
        "lessons": [results[0]["lesson"]],
        "lesson_content_ahead": content_ahead,
        "lesson_quiz_ahead": quiz_ahead,
        "lesson_audit_ahead": audit_ahead,
    }


async def lesson_quiz_generate_node(state: CertificationState):
    index = current_index(state, LESSON_PHASE)
    generated = (state.get("lessons") or [])
    lesson = generated[index] if index < len(generated) else {}
    name = lesson.get("name") or (current_item(state, LESSON_PHASE) or {}).get("name", "")

    # Built alongside the lesson, in the same read-ahead task. Collect it and
    # drop it rather than paying for it a second time.
    #
    # Skipped when the reviewer sent this lesson back: the parked quiz was
    # written against the content they rejected.
    quiz_ahead = dict(state.get("lesson_quiz_ahead") or {})
    if str(index) in quiz_ahead and not state.get("review_instructions"):
        return {
            "lesson_quizzes": [quiz_ahead.pop(str(index))],
            "lesson_quiz_ahead": quiz_ahead,
        }

    return {"lesson_quizzes": [await _quiz_for(state, {**lesson, "name": name})]}


def written_stems(state: CertificationState) -> list[str]:
    """Every question stem this run has produced so far.

    Each assessment is a separate call to the question agent, and until these
    were passed along nothing connected them: a lesson's quiz, the middle exam
    covering that lesson and the major exam above it are three independent
    requests over the same material, so a model asked three times what matters
    most about a lesson answers roughly the same thing three times. All three
    were stored, and the bank ended up with repeats that no single call could
    have detected.

    Deliberately the whole run rather than only the current scope: a question
    repeated between a lesson quiz and its major exam is the case this exists
    to catch, and those live in different parts of the state.
    """
    stems: list[str] = []

    def collect(entries):
        for entry in entries or []:
            if not isinstance(entry, dict):
                continue
            for question in entry.get("questions") or []:
                if isinstance(question, dict):
                    stem = question.get("question")
                    if stem:
                        stems.append(stem)

    collect(state.get("lesson_quizzes"))
    collect(state.get("middle_quizzes"))
    collect(state.get("major_quizzes"))
    for key in ("mock_exam", "diagnostic_exam"):
        collect([state.get(key)] if isinstance(state.get(key), dict) else None)
    for question in state.get("question_bank") or []:
        if isinstance(question, dict) and question.get("question"):
            stems.append(question["question"])
    return stems


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


def _checkpoint_every_n_lessons(state: CertificationState) -> None:
    """Writes the run's output down every Nth lesson.

    Called from the lesson checkpoint because that is the one place where a
    lesson and its quiz are both already merged into the state -- the content
    node and the quiz node each see only their own half.

    The import is local on purpose: `services.certification_run` imports the
    compiled graph, which imports this module, so a module-level import here
    would close that cycle at startup.

    Silent when there is nothing to attach output to (a direct-upload run has
    no certification row) and when the feature is switched off.
    """
    every = get_settings().lesson_checkpoint_every
    if every <= 0:
        return

    written = len(state.get("lessons") or [])
    if written == 0 or written % every != 0:
        return

    certification_id = state.get("certification_id")
    if certification_id is None:
        return

    from app.services.certification_run import checkpoint_progress

    logger.info("Reached %d lessons; checkpointing progress to the database", written)
    checkpoint_progress(certification_id, dict(state))


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
    #
    # Run alongside the lesson in the read-ahead task where there is one, and
    # collected here. A rejected lesson is re-audited: the parked verdict
    # judged the content the reviewer sent back.
    audit_ahead = dict(state.get("lesson_audit_ahead") or {})
    alignment = None
    consumed_audit = False

    if str(index) in audit_ahead and not state.get("review_instructions"):
        alignment = audit_ahead.pop(str(index))
        consumed_audit = True
    elif lesson is not None:
        audit = await _invoke_lesson_auditor({**state, "lessons": [lesson]})
        alignment = audit.model_dump()
        if not audit.passed:
            logger.warning(
                "Lesson '%s' failed curriculum alignment: %s",
                lesson.get("name"), audit.summary,
            )

    _checkpoint_every_n_lessons(state)

    update = {
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
    if consumed_audit:
        # Written back only when one was taken, so an ordinary run does not
        # rewrite this map into every checkpoint for no reason.
        update["lesson_audit_ahead"] = audit_ahead
    return update


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
