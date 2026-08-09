import asyncio

from langgraph.graph import StateGraph, START, END
from app.utils.helpers import get_checkpointer

from .nodes import (
    MAJOR_PHASE,
    MIDDLE_PHASE,
    LESSON_PHASE,
    capture_document_visuals_node,
    document_ingestion_node,
    validate_documents_node,
    route_after_validation,
    curriculum_planning_agent_node,
    await_curriculum_review_node,
    route_after_review,
    apply_major_edit,
    apply_middle_edit,
    apply_lesson_edit,
    major_generate_node,
    major_validate_node,
    middle_generate_node,
    middle_validate_node,
    lesson_content_node,
    lesson_quiz_generate_node,
    lesson_validate_node,
    route_after_middle_advance,
    route_after_major_advance,
    generate_diagnostic_exam_node,
    await_diagnostic_exam_review_node,
    generate_mock_exam_node,
    await_mock_exam_review_node,
    generate_question_bank_node,
    await_question_bank_review_node,
)
from app.graphs.instrumentation import instrument
from .review_loop import register_phase
from .state import CertificationState


def build_certification_graph(checkpointer):
    """Assembles and compiles the graph against the given checkpointer.

    Shape:

        ingest -> plan curriculum -> [review]
        FOR EACH major:
            FOR EACH middle under it:
                FOR EACH lesson under it: content -> quiz -> validate -> [review]
                middle quiz (from those lessons) -> validate -> [review]
            major quiz (from every lesson under it) -> validate -> [review]
        mock -> [review] -> diagnostic -> [review] -> bank -> [review] -> END

    Bottom-up and interleaved, because every assessment is generated *from the
    content it tests*. The previous shape ran three flat passes -- all majors,
    then all middles, then all lessons -- so each category quiz was written
    before a single lesson existed and had nothing to draw on but the
    category's one-line description; the exams likewise sampled the outline
    rather than the teaching. The nesting is produced by `LESSON_PHASE`'s
    `in_scope` boundary test and the two advance routers, not by nested
    subgraphs -- see `nodes.route_after_middle_advance`.

    Categories generate only a quiz: per Q2 they are organizational, and all
    instructional content belongs to lessons.

    Previously each phase fanned out with Send() and took a *single* review
    covering every item, so an admin could not approve one category and
    reject another. The loops below walk one item at a time; "Approve
    Remaining" (see review_loop) lets a reviewer drain the rest of a phase
    once they have seen enough.

    Kept synchronous and dependency-injected: it does no I/O itself, so tests
    can compile against an InMemorySaver with no database.
    """
    workflow = StateGraph(CertificationState)

    # --- Documents ---------------------------------------------------------
    workflow.add_node("validate_documents", instrument(validate_documents_node, "validate_documents"))
    workflow.add_node(
        "capture_document_visuals", instrument(capture_document_visuals_node, "capture_document_visuals")
    )
    workflow.add_node("ingest_documents", instrument(document_ingestion_node, "ingest_documents"))
    workflow.add_node("plan_curriculum", instrument(curriculum_planning_agent_node, "plan_curriculum"))
    workflow.add_node("await_curriculum_review", await_curriculum_review_node)

    workflow.add_edge(START, "validate_documents")
    workflow.add_conditional_edges(
        "validate_documents",
        route_after_validation,
        {"continue": "capture_document_visuals", "stop": END},
    )
    # Visual capture runs before ingestion, not in parallel with it: ingestion
    # clears `uploaded_files` once it has indexed the text (see
    # `document_ingestion_node`), and capture needs those same raw bytes to
    # screenshot figures out of.
    workflow.add_edge("capture_document_visuals", "ingest_documents")
    workflow.add_edge("ingest_documents", "plan_curriculum")
    workflow.add_edge("plan_curriculum", "await_curriculum_review")
    # The walk starts at the deepest level: lessons come before the quizzes
    # that test them.
    workflow.add_conditional_edges(
        "await_curriculum_review",
        route_after_review,
        {"approve": LESSON_PHASE.gate, "regenerate": "plan_curriculum"},
    )

    # --- Per-item loops ----------------------------------------------------
    # Lessons are the only phase with a two-step generation: author the
    # content, then build its quiz from that content. The phase stops at each
    # middle-category boundary (`in_scope`) and hands over to that category's
    # quiz.
    register_phase(
        workflow,
        LESSON_PHASE,
        generate_node=None,
        validate_node=lesson_validate_node,
        exit_to=MIDDLE_PHASE.gate,
        apply_edit_fn=apply_lesson_edit,
        generate_chain=[
            ("lesson_content", lesson_content_node),
            ("lesson_quiz_generate", lesson_quiz_generate_node),
        ],
    )
    register_phase(
        workflow,
        MIDDLE_PHASE,
        generate_node=middle_generate_node,
        validate_node=middle_validate_node,
        # Only reached with no middle categories left at all; the normal path
        # out is the advance router below.
        exit_to=MAJOR_PHASE.gate,
        apply_edit_fn=apply_middle_edit,
        advance_router=route_after_middle_advance,
        advance_targets={"lessons": LESSON_PHASE.gate, "major": MAJOR_PHASE.gate},
    )
    register_phase(
        workflow,
        MAJOR_PHASE,
        generate_node=major_generate_node,
        validate_node=major_validate_node,
        exit_to="generate_mock_exam",
        apply_edit_fn=apply_major_edit,
        advance_router=route_after_major_advance,
        advance_targets={"lessons": LESSON_PHASE.gate, "exams": "generate_mock_exam"},
    )

    # --- Certification-wide assessments ------------------------------------
    workflow.add_node("generate_diagnostic_exam", instrument(generate_diagnostic_exam_node, "generate_diagnostic_exam"))
    workflow.add_node("await_diagnostic_exam_review", await_diagnostic_exam_review_node)
    workflow.add_node("generate_mock_exam", instrument(generate_mock_exam_node, "generate_mock_exam"))
    workflow.add_node("await_mock_exam_review", await_mock_exam_review_node)
    workflow.add_node("generate_question_bank", instrument(generate_question_bank_node, "generate_question_bank"))
    workflow.add_node("await_question_bank_review", await_question_bank_review_node)

    # Mock before diagnostic: the mock exam is the one that has to imitate the
    # real paper, so it runs first while the exam structure is freshest in the
    # reviewer's mind. Both now follow every lesson, so both are written from
    # the certification's actual content.
    workflow.add_edge("generate_mock_exam", "await_mock_exam_review")
    workflow.add_conditional_edges(
        "await_mock_exam_review",
        route_after_review,
        {"approve": "generate_diagnostic_exam", "regenerate": "generate_mock_exam"},
    )
    workflow.add_edge("generate_diagnostic_exam", "await_diagnostic_exam_review")
    workflow.add_conditional_edges(
        "await_diagnostic_exam_review",
        route_after_review,
        {"approve": "generate_question_bank", "regenerate": "generate_diagnostic_exam"},
    )
    workflow.add_edge("generate_question_bank", "await_question_bank_review")
    workflow.add_conditional_edges(
        "await_question_bank_review",
        route_after_review,
        {"approve": END, "regenerate": "generate_question_bank"},
    )

    return workflow.compile(checkpointer=checkpointer)


_graph = None
_graph_lock = asyncio.Lock()


async def get_certification_graph():
    """Process-wide singleton, built on first use.

    Previously this module did `certification_graph = build_certification_graph()`
    at import scope, which opened a Postgres connection just to import
    `app.main` -- so the app could not start (and no test could run) without
    a live database.
    """
    global _graph
    if _graph is not None:
        return _graph
    async with _graph_lock:
        if _graph is None:
            _graph = build_certification_graph(await get_checkpointer())
    return _graph
