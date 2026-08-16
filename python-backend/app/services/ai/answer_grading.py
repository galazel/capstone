"""Marking one written answer.

Java owns everything about the attempt -- which questions were asked, what
each is worth, whether the item is pending -- and asks this service exactly
one question: how many of these points did this answer earn, and why. See
`com.capstone.rebyu.assessment.service.AssessmentAttemptService`.

Two rules shape the whole module.

**The model judges, the code scores.** The agent returns a percentage and a
sentence of feedback; every number Java persists is computed here from that
percentage against `maxPoints`, then clamped and rounded. A model asked to do
decimal arithmetic against a 7.5-point question gets it wrong occasionally and
invisibly, and "occasionally and invisibly" is the worst possible failure mode
for a mark on a learner's transcript.

**A missing verdict is never a zero.** Anything that stops a real judgement --
an exhausted model chain, a malformed response, a sub-question the model
skipped -- raises. Java's caller already treats a failure as "leave it
unmarked" and retries; inventing a 0 here would hand a learner a mark nobody
made. The one exception is a blank submission, which is a real 0 that needs no
model at all.
"""

from __future__ import annotations

import logging
import math
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from langchain_core.messages import HumanMessage

from app.agents.assessment.grading_agent import get_answer_grading_agent
from app.ai import tasks
from app.ai.invocation import structured
from app.ai.router import ainvoke_with_fallback
from app.schemas.assessment.grading_schema import (
    AnswerGradingRequest,
    AnswerGradingResult,
    AnswerVerdict,
    RubricCriterion,
    SubAnswerGrade,
    SubQuestionGradingRequest,
)

logger = logging.getLogger(__name__)

_CENT = Decimal("0.01")
_ZERO = Decimal("0")
_HUNDRED = Decimal("100")

#: Longest learner answer sent to the model, per answer.
#:
#: A written answer box has no length limit, and the tutor task's completion
#: budget is 2000 tokens against a context that also has to hold the question,
#: the reference answer and every sibling sub-answer. Truncating is better than
#: the alternative it replaces: an over-long submission that overflows the
#: context fails the whole item, and failing is what produces the unmarked
#: answer this service exists to prevent. Generous enough that no genuine essay
#: answer reaches it.
_MAX_ANSWER_CHARS = 6000

#: Delimiters around learner text. Any occurrence inside the answer itself is
#: neutralised before the prompt is built -- otherwise a learner could close
#: the block early and have the rest of their submission read as prompt.
_ANSWER_BEGIN = "----- LEARNER ANSWER BEGIN -----"
_ANSWER_END = "----- LEARNER ANSWER END -----"

_BLANK_FEEDBACK = "No answer was submitted, so no marks could be awarded."
_NO_FEEDBACK = "This answer was marked, but no written feedback was produced for it."


class IncompleteGrading(ValueError):
    """The model did not mark every sub-question it was given.

    A `ValueError` on purpose: `app.ai.retry` classifies that as a malformed
    sample and resamples, which is the right response to a model that skipped
    an item. It is raised inside the retried call (see `_completeness_checked`)
    so it reaches that policy instead of escaping past it.
    """


# --- scoring ---------------------------------------------------------------


def _points(value: Decimal | float | int | None) -> Decimal:
    """A question's worth as a non-negative Decimal. Absent or unusable is 0."""
    if value is None:
        return _ZERO
    try:
        points = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return _ZERO
    if not points.is_finite() or points < _ZERO:
        return _ZERO
    return points


def points_for_percent(percent: float | None, max_points: Decimal) -> Decimal:
    """`percent` of `max_points`, clamped into range and rounded to a cent.

    Clamped rather than validated: a model that answers 105 has still made a
    judgement worth keeping ("everything, and then some"), and refusing it
    would cost a resample to arrive at the same 100.
    """
    if max_points <= _ZERO:
        return _ZERO
    if percent is None or not math.isfinite(percent):
        share = _ZERO
    else:
        share = min(max(Decimal(str(percent)), _ZERO), _HUNDRED)
    earned = (max_points * share / _HUNDRED).quantize(_CENT, rounding=ROUND_HALF_UP)
    return min(max(earned, _ZERO), max_points)


def _as_float(points: Decimal) -> float:
    return float(points)


def _clean(text: str | None) -> str:
    return (text or "").strip()


def _feedback_or_default(text: str | None, default: str = _NO_FEEDBACK) -> str:
    return _clean(text) or default


# --- prompt ----------------------------------------------------------------


def _plain(points: Decimal) -> str:
    """A point total without trailing zeros -- "3" and "2.5", never "3.00"."""
    normalized = points.normalize()
    # `normalize()` renders a whole number in exponent form (5 -> 5E+1 for 50).
    return f"{normalized:f}"


def _quote_answer(answer: str | None) -> str:
    """The learner's submission, fenced and defanged.

    The delimiters are stripped from the text itself so the block cannot be
    closed from inside it. That is the only edit made -- everything else is
    passed through verbatim, because silently rewriting a submission would
    change what is being marked.
    """
    text = _clean(answer)
    if not text:
        return f"{_ANSWER_BEGIN}\n(the learner left this blank)\n{_ANSWER_END}"
    for marker in (_ANSWER_BEGIN, _ANSWER_END, "LEARNER ANSWER BEGIN", "LEARNER ANSWER END"):
        text = text.replace(marker, "[removed]")
    if len(text) > _MAX_ANSWER_CHARS:
        text = text[:_MAX_ANSWER_CHARS] + "\n[the submission continues beyond this point]"
    return f"{_ANSWER_BEGIN}\n{text}\n{_ANSWER_END}"


def _criteria_block(criteria: list[RubricCriterion]) -> str:
    lines: list[str] = []
    for criterion in criteria:
        name = _clean(criterion.name)
        if not name:
            continue
        worth = _points(criterion.maxPoints)
        lines.append(f"- {name}" + (f" (worth {_plain(worth)} of the marks)" if worth > _ZERO else ""))
    if not lines:
        return ""
    return "Marking criteria:\n" + "\n".join(lines)


def _marking_context(
    question_text: str,
    reference: str | None,
    criteria: list[RubricCriterion],
    label: str = "Question",
) -> list[str]:
    """The shared question / reference-answer / criteria block."""
    parts = [f"{label}:\n{_clean(question_text) or '(the question text was not recorded)'}"]
    if _clean(reference):
        parts.append(
            "Reference answer (what a full-credit response covers -- the learner's "
            f"wording does not have to match):\n{_clean(reference)}"
        )
    block = _criteria_block(criteria)
    if block:
        parts.append(block)
    return parts


def build_single_prompt(request: AnswerGradingRequest) -> str:
    parts = _marking_context(
        request.questionText, request.rubricGuidance, request.rubricCriteria
    )
    parts.append(_quote_answer(request.learnerAnswer))
    parts.append(
        "Mark this one answer. Set `scorePercent` to the share of the marks it "
        "earned and leave `subScores` empty."
    )
    return "\n\n".join(parts)


def build_sub_question_prompt(
    request: AnswerGradingRequest, sub_questions: list[SubQuestionGradingRequest]
) -> str:
    parts = _marking_context(
        request.questionText,
        request.rubricGuidance,
        request.rubricCriteria,
        label="Overall question",
    )

    for position, sub in enumerate(sub_questions, start=1):
        section = [f"SUB-QUESTION {position}"]
        section.extend(
            _marking_context(sub.questionText, sub.rubricGuidance, sub.rubricCriteria)
        )
        section.append(_quote_answer(sub.learnerAnswer))
        parts.append("\n\n".join(section))

    parts.append(
        f"Mark each of the {len(sub_questions)} sub-questions on its own merits. Return "
        f"exactly {len(sub_questions)} entries in `subScores`, one per sub-question, with "
        "`index` set to that sub-question's number above. Set the top-level "
        "`scorePercent` and `feedback` to describe the answer as a whole."
    )
    return "\n\n".join(parts)


# --- invocation ------------------------------------------------------------


class _CompletenessChecked:
    """Wraps the structured agent so a skipped sub-question is resampled.

    Sits inside the retried, model-fallback-wrapped call for the same reason
    `app.ai.invocation._StructuredAgent` does: a check applied to the result of
    `ainvoke_with_fallback` runs after both policies have given up, so the
    first bad sample would end the grading instead of being retried.
    """

    __slots__ = ("_agent", "_expected")

    def __init__(self, agent: Any, expected: int) -> None:
        self._agent = agent
        self._expected = expected

    async def ainvoke(self, payload: dict, config: dict | None = None) -> AnswerVerdict:
        if config is None:
            verdict = await self._agent.ainvoke(payload)
        else:
            verdict = await self._agent.ainvoke(payload, config)

        wanted = set(range(1, self._expected + 1))
        seen = {score.index for score in verdict.subScores}
        missing = sorted(wanted - seen)
        if missing:
            raise IncompleteGrading(
                f"The grader returned no mark for sub-question(s) "
                f"{', '.join(str(index) for index in missing)} of {self._expected}."
            )
        return verdict


def _completeness_checked(expected: int):
    """An agent factory whose agents mark all `expected` sub-questions or fail."""
    build = structured(get_answer_grading_agent)

    def factory(model: str | None = None):
        return _CompletenessChecked(build(model), expected)

    return factory


async def _invoke(build_agent, prompt: str) -> AnswerVerdict:
    return await ainvoke_with_fallback(
        build_agent,
        {"messages": [HumanMessage(content=prompt)]},
        task=tasks.TUTOR,
    )


# --- entry point -----------------------------------------------------------


async def grade_answer(request: AnswerGradingRequest) -> AnswerGradingResult:
    """Marks one descriptive answer, or one critical-thinking item's sub-answers.

    Raises rather than returning a fabricated score when no judgement could be
    made; the Java caller reads that as "leave it unmarked" and retries.
    """
    if request.subQuestions:
        return await _grade_sub_questions(request, request.subQuestions)
    return await _grade_single(request)


async def _grade_single(request: AnswerGradingRequest) -> AnswerGradingResult:
    max_points = _points(request.maxPoints)

    # A blank submission is the one score that needs no model: there is nothing
    # to read, the mark is 0 whatever the rubric says, and calling out to a
    # model to be told so costs a request and a few seconds of the learner's
    # loading screen per empty box.
    if not _clean(request.learnerAnswer):
        return AnswerGradingResult(earnedPoints=0.0, feedback=_BLANK_FEEDBACK)

    verdict = await _invoke(structured(get_answer_grading_agent), build_single_prompt(request))
    earned = points_for_percent(verdict.scorePercent, max_points)
    return AnswerGradingResult(
        earnedPoints=_as_float(earned),
        feedback=_feedback_or_default(verdict.feedback),
    )


async def _grade_sub_questions(
    request: AnswerGradingRequest, sub_questions: list[SubQuestionGradingRequest]
) -> AnswerGradingResult:
    answered = [sub for sub in sub_questions if _clean(sub.learnerAnswer)]
    if not answered:
        return AnswerGradingResult(
            earnedPoints=0.0,
            feedback=_BLANK_FEEDBACK,
            subScores=[
                SubAnswerGrade(
                    subQuestionId=sub.subQuestionId,
                    earnedPoints=0.0,
                    feedback=_BLANK_FEEDBACK,
                )
                for sub in sub_questions
            ],
        )

    # Every sub-question goes to the model, including the unanswered ones:
    # dropping them would renumber the rest, and the numbering is how a mark
    # finds its way back to a sub-question id. Blanks are forced to 0 below,
    # after the model has spoken, so a stray mark on an empty box cannot stand.
    verdict = await _invoke(
        _completeness_checked(len(sub_questions)),
        build_sub_question_prompt(request, sub_questions),
    )
    by_index = {score.index: score for score in verdict.subScores}

    sub_scores: list[SubAnswerGrade] = []
    total = _ZERO
    for position, sub in enumerate(sub_questions, start=1):
        sub_max = _points(sub.maxPoints)
        if not _clean(sub.learnerAnswer):
            sub_scores.append(
                SubAnswerGrade(
                    subQuestionId=sub.subQuestionId,
                    earnedPoints=0.0,
                    feedback=_BLANK_FEEDBACK,
                )
            )
            continue
        # Present by construction -- `_completeness_checked` refuses a verdict
        # that is missing any index -- so this is a guard, not a fallback.
        scored = by_index[position]
        earned = points_for_percent(scored.scorePercent, sub_max)
        total += earned
        sub_scores.append(
            SubAnswerGrade(
                subQuestionId=sub.subQuestionId,
                earnedPoints=_as_float(earned),
                feedback=_feedback_or_default(scored.feedback),
            )
        )

    # The total is the sum of the parts, not the model's own top-level
    # percentage. Java stores the two separately and never re-adds them, so
    # deriving the total is what keeps a result page from showing a breakdown
    # that does not add up to its own header.
    parent_max = _points(request.maxPoints)
    if parent_max > _ZERO:
        total = min(total, parent_max)

    return AnswerGradingResult(
        earnedPoints=_as_float(total),
        feedback=_feedback_or_default(verdict.feedback),
        subScores=sub_scores,
    )
