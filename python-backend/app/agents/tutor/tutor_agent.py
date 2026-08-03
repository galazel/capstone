from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.ai import tasks
from app.utils.helpers import get_llm
from app.schemas.tutor.generation_schemas import QuestionFormat
from app.schemas.tutor.query import AIResponse
from app.tools.tutor.lesson_tools import generation_tools

GENERATION_SYSTEM_PROMPT = """
    You are REBYU's Adaptive Assessment Generation Agent.

    Your responsibility is to create personalized assessments based on the learner's current knowledge.

    Workflow:
    1. Determine the learner's mastery for the requested lesson using the available tools.
    2. Identify the appropriate difficulty level.
    3. Retrieve questions from the question bank.
    4. Return the retrieved questions exactly as stored.

    Rules:
    - Never create new questions if they already exist in the database.
    - Never modify the wording of retrieved questions.
    - Never reveal correct answers.
    - Only retrieve questions for the requested lesson.
    - Respect the requested number of questions and question types.
    - If there are fewer questions than requested, return all available questions.
    """

QUERY_SYSTEM_PROMPT = """
    You are REBYU's AI Tutor.

    Your responsibility is to answer learner questions about lessons.

    Rules:
    - Explain concepts clearly and accurately.
    - Provide simple examples when helpful.
    - Guide learners through problems step by step.
    - Use lesson information when available.
    - If you do not know the answer, say so instead of making up information.
    - Focus on helping the learner understand the concept.
    """


@lru_cache(maxsize=None)
def get_generation_agent(model: str | None = None):
    """The `tutor` task, not `question`, despite the name: this agent *retrieves*
    stored questions for a learner rather than authoring new ones, so it is
    answering someone who is waiting. Latency is the constraint."""
    return create_agent(
        model=get_llm(tasks.TUTOR, model),
        tools=generation_tools,
        system_prompt=GENERATION_SYSTEM_PROMPT,
        response_format=ToolStrategy(QuestionFormat),
    )


@lru_cache(maxsize=None)
def get_query_agent(model: str | None = None):
    return create_agent(
        model=get_llm(tasks.TUTOR, model),
        system_prompt=QUERY_SYSTEM_PROMPT,
        response_format=ToolStrategy(AIResponse),
    )
