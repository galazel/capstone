"""Shared agent invocation.

`_invoke_question_agent` was previously duplicated verbatim in
`app/graphs/certification/nodes.py` and `app/graphs/question_bank/nodes.py`,
as was the retry decorator above it. Both graphs generate questions
identically -- only scope, context, and instructions differ -- so the call
belongs in one place.

Both helpers take an agent *factory* rather than a built agent. `create_agent()`
bakes the model in at construction, so recovering from an exhausted daily token
budget by switching models means rebuilding -- see `app.ai.router`. Retry and
model fallback both live there, which is why neither function below carries a
retry decorator of its own.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage

from app.agents.certification.question_agent import get_question_generation_agent
from app.ai.prompts.question import build_question_batch_prompt
from app.ai.router import ainvoke_with_fallback
from app.schemas.certification.question_schema import QuestionBatch

logger = logging.getLogger(__name__)


class MissingStructuredResponse(KeyError):
    """The agent finished without calling its structured-output tool.

    `create_agent(response_format=ToolStrategy(...))` only writes
    `structured_response` into the returned state when the model actually
    calls that tool. When it answers in prose instead -- or stops after a
    search tool call -- the key is simply absent.

    Deliberately a `KeyError` subclass: `app.ai.retry` already classifies
    KeyError as malformed structured output worth resampling, and this is
    exactly that failure. `__str__` is overridden because `KeyError` repr's
    its argument, which turned the live error into an unreadable
    `'structured_response'` with no indication of which agent produced it.
    """

    def __str__(self) -> str:
        return self.args[0] if self.args else "Agent returned no structured response."


class _StructuredAgent:
    """Adapter that pulls `structured_response` out of an agent's result.

    Exists so the extraction happens *inside* the retried, model-fallback-wrapped
    call. It used to happen in `invoke_agent` after `ainvoke_with_fallback` had
    already returned, which meant a missing `structured_response` escaped both
    policies: a live lesson run died with a bare `KeyError: 'structured_response'`
    on the first sample, with four unused retries and a whole fallback chain
    sitting behind it.
    """

    __slots__ = ("_agent", "_label")

    def __init__(self, agent: Any, label: str) -> None:
        self._agent = agent
        self._label = label

    async def ainvoke(self, payload: dict, config: dict | None = None) -> Any:
        if config is None:
            response = await self._agent.ainvoke(payload)
        else:
            response = await self._agent.ainvoke(payload, config)
        try:
            return response["structured_response"]
        except (KeyError, TypeError) as error:
            raise MissingStructuredResponse(
                f"{self._label} returned no structured response; "
                "the model answered without calling its output tool."
            ) from error


def structured(build_agent):
    """Wraps an agent factory so it yields agents that return structured output
    directly, and fail loudly (and retryably) when the model does not produce it.
    """
    label = getattr(build_agent, "__name__", "agent")

    def build(model: str | None = None):
        return _StructuredAgent(build_agent(model), label)

    return build


async def invoke_agent(build_agent, prompt: str, *, agent_type: str = "generation"):
    """Invokes any create_agent() factory with a single user message and
    returns its structured response, retrying transient provider failures and
    falling back to another model when one runs out of daily budget.

    `agent_type` selects which model chain to walk, and must match the type the
    factory passes to `get_llm` -- "classification" for the audit agents.
    """
    return await ainvoke_with_fallback(
        structured(build_agent),
        {"messages": [HumanMessage(content=prompt)]},
        agent_type=agent_type,
    )


async def invoke_question_agent(scope: str, context: str, instructions: str) -> QuestionBatch:
    prompt = build_question_batch_prompt(scope, context, instructions)
    return await invoke_agent(get_question_generation_agent, prompt)


def questions_as_dicts(batch: QuestionBatch) -> list[dict]:
    return [question.model_dump() for question in batch.questions]
