from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from agents.tutor.tutor_agent import generation_agent, query_agent
from app.utils.helpers import get_config
from graphs.tutor.state import TutorState


def check_query(state: TutorState):
    if state.get("request"):
        return "ANSWER"

    return "GENERATE"


def generate(state: TutorState):

    response = generation_agent.invoke(
        {
            "messages": [
                HumanMessage(
                    content=f"""
                    Generate an adaptive assessment.
                    
                    Learner ID: {state["learnerId"]}
                    Lesson ID: {state["lessonId"]}
                    
                    Instructions:
                    {state["instructions"]}
                    
                    Question Type:
                    {state["generation_type"]}
                    
                    Number of Questions:
                    {state["items"]}
                    """
                )
            ]
        }
    )

    return {
        "questions": response["structured_response"]
    }


def answer_question(state: TutorState):

    messages = []

    if state.get("summary"):
        messages.append(
            SystemMessage(
                content=f"""
            Previous conversation summary:
            
            {state["summary"]}
            """
            )
        )

    messages.append(
        HumanMessage(
            content=state["request"]
        )
    )

    response = query_agent.invoke(
        {
            "messages": messages
        },
        get_config(
            state["learnerId"],
            state["lessonId"]
        )
    )

    return {
        "messages": [
            AIMessage(
                content=response["structured_response"]
            )
        ]
    }


def should_summarize(state: TutorState):

    if len(state["messages"]) > 20:
        return "SUMMARIZE"

    return "END"


def trim(state: TutorState):

    return {
        "messages": state["messages"][-10:]
    }


def summarize_conversation(state: TutorState):

    summary = query_agent.invoke(
        {
            "messages": [
                HumanMessage(
                    content=f"""
                Summarize this conversation.
                
                {state["messages"]}
                """
                )
            ]
        }
    )

    return {
        "summary": summary["structured_response"]
    }