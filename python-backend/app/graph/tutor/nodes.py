from agents.tutor.tutor_agent import generation_agent, query_agent
from graphs.tutor.state import TutorState

from langchain_core.messages import HumanMessage


def check_query(state: TutorState):
    if not state.get("request"):
        return "GENERATE"

    return "ANSWER"

def generate(state: TutorState):

    response = generation_agent.invoke({
        "messages": [
            HumanMessage(
                content=f"""
                Generate an adaptive assessment.

                Learner ID: {state['learnerId']}
                Lesson ID: {state['lessonId']}

                Instructions:
                {state['instructions']}

                Question Type:
                {state['generation_type']}

                Number of Questions:
                {state['items']}
                """
            )
        ]
    })

    return {
        "questions": response["structured_response"]
    }

def answer_question(state: TutorState):
    """Answer a learner's question."""

    response = query_agent.invoke({
        "messages": [
            HumanMessage(
                content=state["request"]
            )
        ]
    })

    return {
        "response": response["structured_response"]
    }