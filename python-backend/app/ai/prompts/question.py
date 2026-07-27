"""User-message builder for question generation.

Shared by both graphs: the certification workflow's quiz/exam/bank nodes and
the standalone question-bank workflow all generate questions the same way,
differing only in scope, context, and instructions.
"""

from __future__ import annotations


def build_question_batch_prompt(scope: str, context: str, instructions: str) -> str:
    return f"""
Scope:
{scope}

Reference context:
{context}

Generation instructions:
{instructions}
""".strip()
