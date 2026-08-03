from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.ai import tasks
from app.schemas.certification.lesson_audit import LessonAuditResult
from app.utils.helpers import get_llm

SYSTEM_PROMPT = """
You are an AI lesson auditor.

Determine whether the generated lesson follows the provided curriculum, its learning objective, and its key topics.

Check that:
- The lesson belongs to the correct certification, major category, and middle category.
- The learning objective is fully covered.
- Every key topic the curriculum lists for this lesson is covered.
- The content is accurate, complete, and well organized.
- No important topics are missing.
- There is no irrelevant, duplicated, or hallucinated content.

Return only the structured LessonAuditResult.
"""


@lru_cache(maxsize=None)
def get_auditor_lesson_agent(model: str | None = None):
    """Sized by input, not by output: the verdict is a boolean and a sentence,
    but it is reached by reading an entire generated lesson. Hence its own task
    entry rather than sharing the document auditor's -- that one reads a few
    document samples and can run on the cheapest model in the catalogue."""
    return create_agent(
        model=get_llm(tasks.LESSON_AUDIT, model),
        tools=[],
        response_format=ToolStrategy(LessonAuditResult),
        system_prompt=SYSTEM_PROMPT,
    )
