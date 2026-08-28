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
import math
from typing import Any

from langchain_core.messages import HumanMessage

from app.agents.certification.question_agent import get_question_generation_agent
from app.ai import guardrails
from app.ai.json_output import extract_json_object, final_message_text
from app.ai.prompts.question import build_question_batch_prompt
from app.ai.router import ainvoke_with_fallback
from app.core.config import get_settings
from app.domain.choice_order import shuffle_batch
from app.schemas.certification.question_schema import QuestionBatch

logger = logging.getLogger(__name__)

#: Extra generation rounds allowed to replace questions dropped as duplicates.
#: Bounded rather than "loop until full": the model can genuinely run out of
#: distinct questions for a narrow scope, and an unbounded loop would spend the
#: whole budget rediscovering that.
_DEDUPE_TOPUP_ROUNDS = 2

_PUNCTUATION = str.maketrans("", "", ".,;:!?'\"()[]{}-–—")


def _stem_key(question: str) -> str:
    """Normalised question text, for spotting a batch repeating itself.

    Exact-match after normalisation only. Near-duplicate detection already
    exists in `app.domain.validation.questions.find_duplicates`, which reports
    rephrasings to the reviewing admin; doing fuzzy matching here as well would
    silently discard questions a human might want to keep.
    """
    return " ".join(question.lower().translate(_PUNCTUATION).split())


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
            structured = response["structured_response"]
        except (KeyError, TypeError) as error:
            raise MissingStructuredResponse(
                f"{self._label} returned no structured response; "
                "the model answered without calling its output tool."
            ) from error

        # Screened here, inside the retried call, for the same reason the
        # extraction above is: a `GuardrailViolation` is a ValueError, so the
        # retry policy resamples it and the offending text never leaves this
        # method. Doing it in the graph node instead would turn a blockable
        # sample into a failed run.
        guardrails.screen(structured, label=self._label)
        return structured


def structured(build_agent):
    """Wraps an agent factory so it yields agents that return structured output
    directly, and fail loudly (and retryably) when the model does not produce it.
    """
    label = getattr(build_agent, "__name__", "agent")

    def build(model: str | None = None):
        return _StructuredAgent(build_agent(model), label)

    return build


class _JsonAgent:
    """Adapter that reads an agent's final message as JSON and validates it here.

    The counterpart to `_StructuredAgent` for an agent whose output the
    provider cannot be trusted to hand over -- see `app.ai.json_output` for
    why the curriculum planner is one. Everything `_StructuredAgent` gets from
    the tool-call machinery is done explicitly instead: parse, repair, validate
    against the same pydantic model, screen.

    Sits inside the retried, model-fallback-wrapped call for the same reason
    `_StructuredAgent` does -- a `ValidationError` is a `ValueError`, so a bad
    sample is resampled rather than ending the run.
    """

    __slots__ = ("_agent", "_schema", "_label")

    def __init__(self, agent: Any, schema: type, label: str) -> None:
        self._agent = agent
        self._schema = schema
        self._label = label

    async def ainvoke(self, payload: dict, config: dict | None = None) -> Any:
        if config is None:
            response = await self._agent.ainvoke(payload)
        else:
            response = await self._agent.ainvoke(payload, config)

        data = extract_json_object(final_message_text(response), label=self._label)
        parsed = self._schema.model_validate(data)
        guardrails.screen(parsed, label=self._label)
        return parsed


def json_output(build_agent, schema: type):
    """Wraps an agent factory so it yields agents that answer in plain JSON,
    parsed and validated against `schema` in this process."""
    label = getattr(build_agent, "__name__", "agent")

    def build(model: str | None = None):
        return _JsonAgent(build_agent(model), schema, label)

    return build


async def invoke_agent(build_agent, prompt: str, *, task: str = "question"):
    """Invokes any create_agent() factory with a single user message and
    returns its structured response, retrying transient provider failures and
    falling back to another model when one becomes unusable.

    `task` selects which model chain to walk, and MUST match the task the
    factory passes to `get_llm`. A mismatch is silent and expensive: the agent
    would be built from the lesson model and, on the first rate limit, rebuilt
    from the *document auditor's* fallback list -- so the rest of the run would
    write lessons on a model chosen to answer yes/no questions.
    """
    return await ainvoke_with_fallback(
        structured(build_agent),
        {"messages": [HumanMessage(content=prompt)]},
        task=task,
    )


async def invoke_json_agent(
    build_agent, prompt: str, schema: type, *, task: str = "question"
):
    """Invokes an agent that answers in plain JSON and returns it as `schema`.

    Same retry and model-fallback policy as `invoke_agent`; the difference is
    only where the output is validated. Use this when the provider's own
    tool-argument validation is the thing standing between a usable sample and
    a failed run -- see `app.ai.json_output`.
    """
    return await ainvoke_with_fallback(
        json_output(build_agent, schema),
        {"messages": [HumanMessage(content=prompt)]},
        task=task,
    )


async def invoke_question_agent(
    scope: str, context: str, instructions: str, *, count: int | None = None
) -> QuestionBatch:
    """Generates a question batch, splitting a large ask across several calls.

    A whole exam cannot be written in one response. The model's completion
    budget is `ai_question_max_tokens`, and a single MCQ costs roughly 250
    tokens because it carries an explanation for every choice -- so a 50-item
    mock exam wants ~12k tokens and gets truncated at the ceiling. A truncated
    tool call is malformed, which fails, which retries with backoff, which is
    why the mock exam took so long that the Java gateway's 120s read timeout
    fired before it ever returned.

    Batching also bounds the damage of a bad sample: one failed batch of 15 is
    resampled, rather than all 50 questions.
    """
    if count is None or count <= 0:
        return await invoke_agent(
            get_question_generation_agent, build_question_batch_prompt(scope, context, instructions)
        )

    size = get_settings().question_batch_size
    if count <= size:
        return await invoke_agent(
            get_question_generation_agent, build_question_batch_prompt(scope, context, instructions)
        )

    batches = math.ceil(count / size)
    questions: list = []
    seen: set[str] = set()
    # Extra rounds to replace duplicates. A later batch cannot see the earlier
    # ones except through the "already written" list below, and the model still
    # repeats itself -- a live 30-question exam came back with 20 distinct
    # stems. Without top-up rounds, dropping the repeats would just leave the
    # exam short.
    for index in range(batches + _DEDUPE_TOPUP_ROUNDS):
        wanted = min(size, count - len(questions))
        if wanted <= 0:
            break

        # The caller's instructions still carry the *total* ("Generate exactly
        # 50 questions"), so this has to override it unambiguously rather than
        # sit alongside it.
        batched = (
            f"This is batch {index + 1} of {batches} for this assessment.\n"
            f"Generate exactly {wanted} questions in THIS response. Ignore any other "
            f"question count mentioned below -- {wanted} is the count for this batch.\n\n"
            f"{instructions}"
        )
        if questions:
            already = "\n".join(f"- {q.question}" for q in questions[-40:])
            batched += (
                "\n\nThese questions were already written for this same assessment. "
                f"Do not repeat or rephrase any of them:\n{already}"
            )

        result = await invoke_agent(
            get_question_generation_agent, build_question_batch_prompt(scope, context, batched)
        )

        fresh = 0
        for question in result.questions:
            key = _stem_key(question.question)
            if key in seen:
                continue
            seen.add(key)
            questions.append(question)
            fresh += 1

        logger.info(
            "Question batch %d for %.40s: %d question(s), %d new, %d/%d total",
            index + 1, scope, len(result.questions), fresh, len(questions), count,
        )
        if fresh == 0:
            # The model has run out of distinct questions for this scope.
            # Further rounds would cost tokens to produce nothing.
            logger.warning(
                "Stopping %.40s at %d/%d questions: a whole batch was duplicates",
                scope, len(questions), count,
            )
            break

    if len(questions) < count:
        logger.warning(
            "%.40s produced %d of %d requested questions after de-duplication",
            scope, len(questions), count,
        )

    return QuestionBatch(scope=scope, questions=questions[:count])


def questions_as_dicts(batch: QuestionBatch) -> list[dict]:
    """The generation boundary: every generated question in both graphs
    becomes a plain dict here.

    Which makes it the one place to randomise where each MCQ's correct answer
    sits. The prompt asks the model to vary it and the batch check reports when
    it did not, but neither guarantees it -- a model that has settled on the
    second option stays settled. See `app.domain.choice_order`.
    """
    return shuffle_batch([question.model_dump() for question in batch.questions])
