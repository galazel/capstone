import asyncio

from langgraph.graph import StateGraph, START, END
from app.utils.helpers import get_checkpointer

from .nodes import (
    MAJOR_PHASE,
    MIDDLE_PHASE,
    LESSON_PHASE,
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

    Shape (Phase 2b step 12):

        ingest -> plan curriculum -> [review]
        FOR EACH major:  quiz -> validate -> [review]
        FOR EACH middle: quiz -> validate -> [review]
        FOR EACH lesson: content -> quiz -> validate -> [review]
        diagnostic -> [review] -> mock -> [review] -> bank -> [review] -> END

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
    workflow.add_node("ingest_documents", instrument(document_ingestion_node, "ingest_documents"))
    workflow.add_node("plan_curriculum", instrument(curriculum_planning_agent_node, "plan_curriculum"))
    workflow.add_node("await_curriculum_review", await_curriculum_review_node)

    workflow.add_edge(START, "validate_documents")
    workflow.add_conditional_edges(
        "validate_documents",
        route_after_validation,
        {"continue": "ingest_documents", "stop": END},
    )
    workflow.add_edge("ingest_documents", "plan_curriculum")
    workflow.add_edge("plan_curriculum", "await_curriculum_review")
    workflow.add_conditional_edges(
        "await_curriculum_review",
        route_after_review,
        {"approve": MAJOR_PHASE.gate, "regenerate": "plan_curriculum"},
    )

    # --- Per-item loops ----------------------------------------------------
    register_phase(
        workflow,
        MAJOR_PHASE,
        generate_node=major_generate_node,
        validate_node=major_validate_node,
        exit_to=MIDDLE_PHASE.gate,
        apply_edit_fn=apply_major_edit,
    )
    register_phase(
        workflow,
        MIDDLE_PHASE,
        generate_node=middle_generate_node,
        validate_node=middle_validate_node,
        exit_to=LESSON_PHASE.gate,
        apply_edit_fn=apply_middle_edit,
    )
    # Lessons are the only phase with a two-step generation: author the
    # content, then build its quiz from that content.
    register_phase(
        workflow,
        LESSON_PHASE,
        generate_node=None,
        validate_node=lesson_validate_node,
        exit_to="generate_diagnostic_exam",
        apply_edit_fn=apply_lesson_edit,
        generate_chain=[
            ("lesson_content", lesson_content_node),
            ("lesson_quiz_generate", lesson_quiz_generate_node),
        ],
    )

    # --- Certification-wide assessments ------------------------------------
    workflow.add_node("generate_diagnostic_exam", instrument(generate_diagnostic_exam_node, "generate_diagnostic_exam"))
    workflow.add_node("await_diagnostic_exam_review", await_diagnostic_exam_review_node)
    workflow.add_node("generate_mock_exam", instrument(generate_mock_exam_node, "generate_mock_exam"))
    workflow.add_node("await_mock_exam_review", await_mock_exam_review_node)
    workflow.add_node("generate_question_bank", instrument(generate_question_bank_node, "generate_question_bank"))
    workflow.add_node("await_question_bank_review", await_question_bank_review_node)

    workflow.add_edge("generate_diagnostic_exam", "await_diagnostic_exam_review")
    workflow.add_conditional_edges(
        "await_diagnostic_exam_review",
        route_after_review,
        {"approve": "generate_mock_exam", "regenerate": "generate_diagnostic_exam"},
    )
    workflow.add_edge("generate_mock_exam", "await_mock_exam_review")
    workflow.add_conditional_edges(
        "await_mock_exam_review",
        route_after_review,
        {"approve": "generate_question_bank", "regenerate": "generate_mock_exam"},
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
