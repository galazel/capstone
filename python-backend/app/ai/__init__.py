"""LLM-facing concerns: prompt text, retry policy, and agent invocation.

Separated from `app/graphs/` so orchestration (what runs when) stays distinct
from prompting (what the model is told) and resilience (what happens when the
provider misbehaves). Previously all three were interleaved inside node
functions and duplicated across the two graphs.
"""
