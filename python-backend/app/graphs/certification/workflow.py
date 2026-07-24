from langgraph.graph import StateGraph, START, END
from app.utils.helpers import checkpointer

from .nodes import (
    document_ingestion_node,
    validate_documents_node,
    route_after_validation,
    curriculum_planning_agent_node,
    create_parallel_lessons,
    lesson_creation_agent_node,
    validate_lessons_node,
    route_after_lesson_validation,
)

from .state import CertificationState


def build_certification_graph():
    workflow = StateGraph(CertificationState)

    # Nodes
    workflow.add_node("validate_documents", validate_documents_node)
    workflow.add_node("ingest_documents", document_ingestion_node)
    workflow.add_node("plan_curriculum", curriculum_planning_agent_node)
    workflow.add_node("expand_lessons", create_parallel_lessons)
    workflow.add_node("lesson_creation_agent_node", lesson_creation_agent_node)
    workflow.add_node("validate_lessons", validate_lessons_node)

    # Start
    workflow.add_edge(START, "validate_documents")

    # Validate uploaded documents
    workflow.add_conditional_edges(
        "validate_documents",
        route_after_validation,
        {
            "continue": "ingest_documents",
            "stop": END,
        },
    )

    # Curriculum
    workflow.add_edge("ingest_documents", "plan_curriculum")

    # Create Send(...) objects
    workflow.add_edge("plan_curriculum", "expand_lessons")

    # Parallel lesson generation
    workflow.add_conditional_edges(
        "expand_lessons",
        create_parallel_lessons,
    )

    # Runs AFTER ALL Send() branches finish
    workflow.add_edge(
        "lesson_creation_agent_node",
        "validate_lessons",
    )

    # Decide whether to finish or retry
    workflow.add_conditional_edges(
        "validate_lessons",
        route_after_lesson_validation,
        {
            "passed": END,
            "retry": "expand_lessons",
        },
    )

    return workflow.compile(
        checkpointer=checkpointer,
    )


certification_graph = build_certification_graph()