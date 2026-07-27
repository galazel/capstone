import asyncio

from langgraph.graph import StateGraph, START, END


from app.utils.helpers import get_checkpointer
from app.graphs.tutor.nodes import check_query, generate, answer_question, summarize_conversation, trim, should_summarize
from app.graphs.tutor.state import TutorState


def build_graph(checkpointer):

    graph = StateGraph(TutorState)

    graph.add_node("check_query", check_query)
    graph.add_node("generate_questions", generate)
    graph.add_node("respond_question", answer_question)
    graph.add_node("summarize_conversation", summarize_conversation)
    graph.add_node("trim_conversation", trim)

    graph.add_edge(START, "check_query")

    graph.add_conditional_edges(
        "check_query",
        check_query,
        {
            "GENERATE": "generate_questions",
            "ANSWER": "respond_question",
        }
    )

    graph.add_edge(
        "generate_questions",
        END
    )

    graph.add_conditional_edges(
        "respond_question",
        should_summarize,
        {
            "SUMMARIZE": "summarize_conversation",
            "END": END,
        }
    )

    graph.add_edge(
        "summarize_conversation",
        "trim_conversation"
    )

    graph.add_edge(
        "trim_conversation",
        END
    )

    return graph.compile(checkpointer=checkpointer)


_graph = None
_graph_lock = asyncio.Lock()


async def get_tutor_graph():
    """Cached so callers stop rebuilding (and re-compiling) the graph on
    every request -- tutor_service.py called build_graph() per invocation."""
    global _graph
    if _graph is not None:
        return _graph
    async with _graph_lock:
        if _graph is None:
            _graph = build_graph(await get_checkpointer())
    return _graph