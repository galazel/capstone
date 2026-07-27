"""Shared agent invocation.

`_invoke_question_agent` was previously duplicated verbatim in
`app/graphs/certification/nodes.py` and `app/graphs/question_bank/nodes.py`,
as was the retry decorator above it. Both graphs generate questions
identically -- only scope, context, and instructions differ -- so the call
belongs in one place.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage

from app.agents.certification.question_agent import get_question_generation_agent
from app.ai.prompts.question import build_question_batch_prompt
from app.ai.retry import retry_llm_call
from app.schemas.certification.question_schema import QuestionBatch

logger = logging.getLogger(__name__)


@retry_llm_call
async def invoke_agent(agent, prompt: str):
    """Invokes any create_agent() result with a single user message and
    returns its structured response, retrying transient provider failures."""
    response = await agent.ainvoke({"messages": [HumanMessage(content=prompt)]})
    return response["structured_response"]


@retry_llm_call
async def invoke_question_agent(scope: str, context: str, instructions: str) -> QuestionBatch:
    agent = get_question_generation_agent()
    prompt = build_question_batch_prompt(scope, context, instructions)
    response = await agent.ainvoke({"messages": [HumanMessage(content=prompt)]})
    return response["structured_response"]


def questions_as_dicts(batch: QuestionBatch) -> list[dict]:
    return [question.model_dump() for question in batch.questions]
