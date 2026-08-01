"""Extraction of an agent's structured response.

A live lesson run died with a bare `KeyError: 'structured_response'`:

    Writing lesson content failed -- 'structured_response' (29643ms)

`create_agent(response_format=ToolStrategy(...))` only writes that key when
the model actually calls its output tool; when it answers in prose instead,
the key is simply absent. `app.ai.retry` has always classed KeyError as
malformed output worth resampling -- but the extraction happened in
`invoke_agent` *after* `ainvoke_with_fallback` returned, so neither the retry
policy nor the model-fallback chain ever saw it. One bad sample killed the run
with four unused retries behind it.

These tests pin the extraction inside the retried call.
"""

from __future__ import annotations

import pytest

from app.ai import invocation
from app.ai.invocation import MissingStructuredResponse, structured
from app.ai.retry import is_retryable


class _Agent:
    """Returns each queued response in turn, recording every invocation."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def ainvoke(self, payload, config=None):
        self.calls += 1
        return self._responses[min(self.calls - 1, len(self._responses) - 1)]


def _factory(agent):
    def build(model=None):
        return agent

    build.__name__ = "get_lesson_generation_agent"
    return build


# --- extraction -----------------------------------------------------------

async def test_the_structured_response_is_returned_unwrapped():
    agent = _Agent([{"structured_response": {"title": "Lesson 1"}}])
    assert await structured(_factory(agent))().ainvoke({}) == {"title": "Lesson 1"}


async def test_a_missing_structured_response_names_the_agent_that_failed():
    """`KeyError: 'structured_response'` was the entire live error message --
    it did not say which of the six agents produced it."""
    agent = _Agent([{"messages": ["I'm afraid I can't do that."]}])

    with pytest.raises(MissingStructuredResponse) as caught:
        await structured(_factory(agent))().ainvoke({})

    assert "get_lesson_generation_agent" in str(caught.value)


def test_the_failure_is_classed_as_retryable():
    """The point of the change: this now reaches the retry policy, which
    already treats malformed structured output as worth another sample."""
    assert is_retryable(MissingStructuredResponse("no structured response"))


def test_the_message_is_readable_rather_than_a_bare_repr():
    """KeyError repr's its argument, which is how the live log ended up
    showing only `'structured_response'`."""
    assert str(MissingStructuredResponse("Lesson agent returned nothing.")) == (
        "Lesson agent returned nothing."
    )


async def test_a_non_dict_result_fails_the_same_way_rather_than_raising_TypeError():
    agent = _Agent([None])
    with pytest.raises(MissingStructuredResponse):
        await structured(_factory(agent))().ainvoke({})


# --- it is inside the retried region --------------------------------------

async def test_a_missing_response_is_resampled_instead_of_killing_the_run(monkeypatch):
    """End to end through `invoke_agent`: the first sample answers in prose,
    the second calls the output tool, and the caller sees only the success."""
    agent = _Agent(
        [
            {"messages": ["prose, no tool call"]},
            {"structured_response": {"title": "Lesson 1"}},
        ]
    )
    monkeypatch.setattr(invocation, "ainvoke_with_fallback", _immediate_retry_fallback)

    result = await invocation.invoke_agent(_factory(agent), "write lesson 1")

    assert result == {"title": "Lesson 1"}
    assert agent.calls == 2, "the bad sample must be retried, not raised"


async def test_a_persistently_unstructured_agent_still_fails(monkeypatch):
    agent = _Agent([{"messages": ["prose"]}])
    monkeypatch.setattr(invocation, "ainvoke_with_fallback", _immediate_retry_fallback)

    with pytest.raises(MissingStructuredResponse):
        await invocation.invoke_agent(_factory(agent), "write lesson 1")

    assert agent.calls == 3, "it should exhaust the attempts rather than give up at one"


async def _immediate_retry_fallback(build_agent, payload, *, agent_type="generation", config=None):
    """`ainvoke_with_fallback` with the real retry policy but no sleeping and
    no model chain -- the model chain needs live settings, the retry behaviour
    is what these tests are about."""
    from app.ai.retry import llm_retry

    @llm_retry(attempts=3, initial=0.001, maximum=0.002)
    async def _once():
        return await build_agent("test-model").ainvoke(payload)

    return await _once()
