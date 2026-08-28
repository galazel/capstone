"""Randomising where an MCQ's correct answer sits.

The system prompt asks the model to spread the correct answer across all four
positions. Models are poor at that: asked for a hundred questions in batches,
one will put the answer in the same slot most of the time, and every question
is individually valid so nothing upstream objects. The batch-level check in
`app.domain.validation.questions` reports the skew, but reporting it only tells
a reviewer that a hundred questions need fixing.

Shuffling after generation is the guarantee the prompt cannot give. It is a
pure permutation of one question's own options -- the correct answer travels
with its index and each choice with its explanation -- so nothing about what
the question tests changes.

Applied once, at the generation boundary (`app.ai.invocation.questions_as_dicts`),
never on the way back out of storage: reshuffling a stored question would move
the answer under an admin who is editing it, and invalidate a learner's
in-flight attempt.
"""

from __future__ import annotations

import logging
import random
from typing import Any

logger = logging.getLogger(__name__)


def shuffle_choices(question: dict[str, Any], rng: random.Random | None = None) -> dict[str, Any]:
    """Returns the question with its choices permuted.

    Left untouched, and returned as-is, when the question is not a four-option
    MCQ or when its parts do not line up -- a `correct_choice_index` out of
    range, or an explanation list of a different length than the choices.
    Permuting those would produce a question whose stated answer is wrong or
    whose explanations describe other options, which is worse than a
    predictable position.
    """
    if question.get("question_type") != "MCQ":
        return question

    choices = question.get("choices") or []
    correct = question.get("correct_choice_index")
    if len(choices) < 2 or correct is None or not 0 <= correct < len(choices):
        return question

    explanations = question.get("choice_explanations") or []
    has_explanations = bool(explanations)
    if has_explanations and len(explanations) != len(choices):
        logger.warning(
            "Not shuffling a question with %d choice(s) and %d explanation(s): "
            "the two cannot be kept aligned",
            len(choices), len(explanations),
        )
        return question

    rng = rng or random
    order = list(range(len(choices)))
    rng.shuffle(order)

    shuffled = dict(question)
    shuffled["choices"] = [choices[i] for i in order]
    shuffled["correct_choice_index"] = order.index(correct)
    if has_explanations:
        shuffled["choice_explanations"] = [explanations[i] for i in order]
    return shuffled


def shuffle_batch(
    questions: list[dict[str, Any]], rng: random.Random | None = None
) -> list[dict[str, Any]]:
    """`shuffle_choices` over a batch. Order of the questions themselves is
    preserved -- only each question's own options move."""
    return [shuffle_choices(question, rng) for question in questions]
