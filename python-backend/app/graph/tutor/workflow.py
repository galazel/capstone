from langgraph.graph import StateGraph, START, END

from graphs.tutor.state import TutorState
from graphs.tutor.nodes import check_query, generate, answer_question


graph = StateGraph(TutorState)


def build_graph():
    graph.add_node("check_query", check_query)
    graph.add_node("generate_questions", generate)
    graph.add_node("respond_question", answer_question)

    graph.add_edge(START, "check_query")

    graph.add_conditional_edges(
        "check_query",
        check_query,
        {
            "GENERATE": "generate_questions",
            "ANSWER": "respond_question",
        }
    )

    graph.add_edge("generate_questions", END)
    graph.add_edge("respond_question", END)

    return graph.compile()
