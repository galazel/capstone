from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.schemas.certification.lesson_audit import LessonAuditResult
from app.utils.helpers import get_llm

SYSTEM_PROMPT = """
You are an AI lesson auditor.

Determine whether the generated lesson follows the provided curriculum, learning objective, and lessonGenerationInstructions.

Check that:
- The lesson belongs to the correct certification, major category, and middle category.
- The learning objective is fully covered.
- The lesson follows the provided instructions.
- The content is accurate, complete, and well organized.
- No important topics are missing.
- There is no irrelevant, duplicated, or hallucinated content.

Return only the structured LessonAuditResult.
"""


@lru_cache(maxsize=None)
def get_auditor_lesson_agent(model: str | None = None):
    return create_agent(
        model=get_llm("classification", model),
        tools=[],
        response_format=ToolStrategy(LessonAuditResult),
        system_prompt=SYSTEM_PROMPT,
    )
