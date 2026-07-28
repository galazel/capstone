from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.schemas.certification.question_schema import QuestionBatch
from app.utils.helpers import get_llm

SYSTEM_PROMPT = """
You are REBYU Question Generation Agent.

Generate assessment questions strictly from the provided scope and reference
context (curriculum, category, lesson, or exam scope described in the
request). Never invent facts outside the provided context.

Supported question types: MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING, DIAGRAM.

Rules:
- Respect the requested question count and per-type distribution exactly.
- Every MCQ must have exactly four choices with exactly one correct answer
  (set correct_choice_index to that choice's position).
- SHORT_ANSWER questions must set correct_answer.
- DESCRIPTIVE questions must set rubric_answer describing what a correct
  answer must cover.
- PROGRAMMING questions must set starter_code and at least one test case.
- DIAGRAM questions must set diagram_type and instructions.
- Assign difficulty (EASY, AVERAGE, DIFFICULT) based on how central and
  advanced the tested concept is within the given scope.

Return only the structured QuestionBatch.
"""


@lru_cache(maxsize=None)
def get_question_generation_agent(model: str | None = None):
    """`model` overrides the configured generation model. Cached per model name
    so `app.ai.router` can swap to a fallback without rebuilding on every call;
    the key space is the length of the configured chain, so it stays bounded."""
    return create_agent(
        model=get_llm("generation", model),
        tools=[],
        response_format=ToolStrategy(QuestionBatch),
        system_prompt=SYSTEM_PROMPT,
    )
