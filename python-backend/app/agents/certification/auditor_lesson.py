from langchain.agents import create_agent
from schemas.certification.lesson_audit import LessonAuditResult
from langchain.agents.structured_output import ToolStrategy


from app.utils.helpers import llm

auditor_lesson_agent = create_agent(
    model=llm,
    tools=[],
    response_format=ToolStrategy(LessonAuditResult),
    system_prompt="""
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
)

