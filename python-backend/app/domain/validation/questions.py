"""Deterministic quality checks over a generated question batch.

The Phase 2 brief asks for AI validation detecting "duplicate questions,
incorrect answers, missing explanations, hallucinations, poor distractors,
formatting issues, objective alignment problems, Bloom's taxonomy
inconsistencies, and difficulty imbalance".

Most of those are decidable *without* another model call, which makes them
free, instant, and deterministic. Doing them here means the LLM-based checks
that remain can focus on the genuinely semantic questions.

Everything in this module is a pure function over plain data.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Iterable

from app.domain.validation.report import Severity, ValidationIssue, ValidationReport

# Near-duplicate cutoff. Tuned against real rephrasings: swapping one word
# in a ten-word stem ("primary" -> "main") scores ~0.82, so a 0.85 threshold
# silently misses exactly the case this check exists to catch. Genuinely
# different questions on the same topic score well below 0.6.
DUPLICATE_SIMILARITY_THRESHOLD = 0.75

# Single source of truth: `QuestionDraft` now *rejects* a generated question
# below this floor, while this layer still reports it for questions that never
# went through generation (a reviewer's manual edit, an older run's artifact).
from app.schemas.certification.question_schema import (  # noqa: E402
    MIN_EXPLANATION_CHARS,
    MIN_PROGRAMMING_TEST_CASES,
)
# Beyond this, a "question" is usually a passage the model forgot to trim.
MAX_QUESTION_CHARS = 2000

_FILLER_DISTRACTORS = {
    "none of the above", "all of the above", "none", "n/a", "na",
    "not applicable", "other", "true", "false",
}

_WORD_RE = re.compile(r"\w+")


def _normalize(text: str) -> str:
    """Lowercased word sequence -- ignores punctuation and spacing so
    near-identical questions collapse to the same key."""
    return " ".join(_WORD_RE.findall((text or "").lower()))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _get(question: Any, field: str, default=None):
    """Reads a field from either a QuestionDraft or a plain dict.

    Nodes hand these around as dicts (`model_dump()`), but callers and tests
    may pass models; supporting both avoids forced conversions at every edge.
    """
    if isinstance(question, dict):
        return question.get(field, default)
    return getattr(question, field, default)


def find_duplicates(
    questions: list[Any], threshold: float = DUPLICATE_SIMILARITY_THRESHOLD
) -> list[tuple[int, int, float]]:
    """Returns (i, j, similarity) for near-duplicate question pairs.

    Exact-match detection alone is useless here: a model asked for 100
    questions rarely repeats verbatim, it rephrases. Token-set Jaccard
    catches the rephrasings.
    """
    token_sets = [set(_normalize(_get(q, "question", "")).split()) for q in questions]
    duplicates: list[tuple[int, int, float]] = []
    for i in range(len(questions)):
        for j in range(i + 1, len(questions)):
            similarity = _jaccard(token_sets[i], token_sets[j])
            if similarity >= threshold:
                duplicates.append((i, j, round(similarity, 3)))
    return duplicates


def _check_duplicates(questions: list[Any], report_issues: list[ValidationIssue]) -> None:
    duplicates = find_duplicates(questions)
    if not duplicates:
        return
    indices = sorted({i for pair in duplicates for i in pair[:2]})
    report_issues.append(
        ValidationIssue(
            code="DUPLICATE_QUESTIONS",
            severity=Severity.ERROR,
            message=f"{len(duplicates)} near-duplicate question pair(s) detected.",
            question_indices=indices,
            context={"pairs": [{"a": a, "b": b, "similarity": s} for a, b, s in duplicates]},
        )
    )


def _check_explanations(questions: list[Any], issues: list[ValidationIssue]) -> None:
    missing = [
        index
        for index, question in enumerate(questions)
        if len((_get(question, "explanation", "") or "").strip()) < MIN_EXPLANATION_CHARS
    ]
    if missing:
        issues.append(
            ValidationIssue(
                code="MISSING_EXPLANATION",
                severity=Severity.WARNING,
                message=(
                    f"{len(missing)} question(s) have no meaningful explanation "
                    f"(under {MIN_EXPLANATION_CHARS} characters)."
                ),
                question_indices=missing,
            )
        )


def _check_distractors(questions: list[Any], issues: list[ValidationIssue]) -> None:
    filler: list[int] = []
    trivial: list[int] = []

    for index, question in enumerate(questions):
        if _get(question, "question_type") != "MCQ":
            continue
        choices = _get(question, "choices", []) or []
        lowered = [(c or "").strip().lower() for c in choices]

        if any(choice in _FILLER_DISTRACTORS for choice in lowered):
            filler.append(index)
        # Only genuinely blank options. Length is not a signal: "4", "O(1)",
        # and "IP" are all legitimate one-or-two-character answers, and an
        # earlier version of this check flagged every numeric MCQ.
        if any(not choice for choice in lowered):
            trivial.append(index)

    if filler:
        issues.append(
            ValidationIssue(
                code="FILLER_DISTRACTORS",
                severity=Severity.WARNING,
                message=(
                    f"{len(filler)} MCQ(s) use filler options such as "
                    f"'none of the above', which test recall of the option list "
                    f"rather than the concept."
                ),
                question_indices=filler,
            )
        )
    if trivial:
        issues.append(
            ValidationIssue(
                code="BLANK_DISTRACTORS",
                severity=Severity.WARNING,
                message=f"{len(trivial)} MCQ(s) contain a blank choice.",
                question_indices=trivial,
            )
        )


#: Below this many MCQs, an uneven spread of correct answers or of choice
#: lengths is just small numbers, not a pattern. Checking earlier would flag a
#: four-question lesson quiz for having two answers in the same position.
MIN_MCQS_FOR_PATTERN_CHECKS = 8

#: Share of a batch's correct answers that may sit in one position before it
#: reads as a habit rather than chance. Uniform would be 0.25; a model that has
#: settled on "B" typically lands well above this.
MAX_CORRECT_POSITION_SHARE = 0.5

#: Share of MCQs whose correct choice may be the longest option. Consistently
#: longest is the oldest tell in multiple choice, and a learner who has noticed
#: it can pass without reading the stem.
MAX_LONGEST_CORRECT_SHARE = 0.6

#: How many questions may open with the same three words. A share, not a count:
#: ten identical openings in a hundred questions is variety, in twelve it is a
#: template.
MAX_SAME_OPENING_SHARE = 0.4
MIN_QUESTIONS_FOR_OPENING_CHECK = 6

#: A PROGRAMMING question is a task, not a prompt: fewer test cases than this
#: cannot cover both the ordinary case and the edges, and a stem this short
#: cannot have stated input format, output format, and constraints.
MIN_PROGRAMMING_QUESTION_CHARS = 200

#: A DIAGRAM question has to describe a scenario worth modelling and brief what
#: the diagram must show. Anything shorter is a labelling exercise.
MIN_DIAGRAM_QUESTION_CHARS = 200
MIN_DIAGRAM_INSTRUCTION_CHARS = 120


def _mcqs(questions: list[Any]) -> list[tuple[int, Any]]:
    return [
        (index, question)
        for index, question in enumerate(questions)
        if _get(question, "question_type") == "MCQ"
    ]


def _check_answer_positions(questions: list[Any], issues: list[ValidationIssue]) -> None:
    """Whether the correct answer keeps landing in the same place.

    A model asked for a hundred questions will happily put the answer at index
    1 in most of them, and nothing upstream notices: every question is
    individually valid. It is only visible across a batch, which is exactly
    what this layer sees.
    """
    positions = [
        (index, _get(question, "correct_choice_index"))
        for index, question in _mcqs(questions)
    ]
    positions = [(index, at) for index, at in positions if at is not None]
    if len(positions) < MIN_MCQS_FOR_PATTERN_CHECKS:
        return

    counts = Counter(at for _, at in positions)
    position, hits = counts.most_common(1)[0]
    if hits / len(positions) <= MAX_CORRECT_POSITION_SHARE:
        return

    issues.append(
        ValidationIssue(
            code="PREDICTABLE_ANSWER_POSITION",
            severity=Severity.WARNING,
            message=(
                f"{hits} of {len(positions)} MCQ(s) put the correct answer at "
                f"position {position + 1}. A learner who spots that can pass "
                f"without reading the questions."
            ),
            question_indices=[index for index, at in positions if at == position],
            context={"distribution": {str(k): v for k, v in sorted(counts.items())}},
        )
    )


def _check_correct_choice_length(questions: list[Any], issues: list[ValidationIssue]) -> None:
    """Whether the correct answer is habitually the longest option.

    Length is the tell that survives everything else: a writer pads the correct
    choice with the qualifications that make it defensible while the
    distractors stay short. Only the *sole* longest counts -- a tie gives
    nothing away.
    """
    longest: list[int] = []
    considered = 0

    for index, question in _mcqs(questions):
        choices = _get(question, "choices", []) or []
        correct = _get(question, "correct_choice_index")
        if correct is None or len(choices) < 2 or not 0 <= correct < len(choices):
            continue
        considered += 1
        lengths = [len((choice or "").strip()) for choice in choices]
        if lengths[correct] == max(lengths) and lengths.count(max(lengths)) == 1:
            longest.append(index)

    if considered < MIN_MCQS_FOR_PATTERN_CHECKS:
        return
    if len(longest) / considered <= MAX_LONGEST_CORRECT_SHARE:
        return

    issues.append(
        ValidationIssue(
            code="CORRECT_ANSWER_IS_LONGEST",
            severity=Severity.WARNING,
            message=(
                f"In {len(longest)} of {considered} MCQ(s) the correct answer is the "
                f"longest choice. Match the options for length and detail so the "
                f"answer cannot be picked out by shape."
            ),
            question_indices=longest,
        )
    )


def _check_stem_variety(questions: list[Any], issues: list[ValidationIssue]) -> None:
    """Whether the questions all open the same way.

    "Which of the following ..." twenty times over is the signature of
    generated assessment, and it narrows what is tested: that opening only
    introduces recognition questions.
    """
    if len(questions) < MIN_QUESTIONS_FOR_OPENING_CHECK:
        return

    openings: dict[str, list[int]] = {}
    for index, question in enumerate(questions):
        words = _normalize(_get(question, "question", "")).split()[:3]
        if words:
            openings.setdefault(" ".join(words), []).append(index)
    if not openings:
        return

    opening, indices = max(openings.items(), key=lambda item: len(item[1]))
    if len(indices) / len(questions) <= MAX_SAME_OPENING_SHARE:
        return

    issues.append(
        ValidationIssue(
            code="REPETITIVE_QUESTION_OPENINGS",
            severity=Severity.WARNING,
            message=(
                f"{len(indices)} of {len(questions)} question(s) open with "
                f"'{opening}...'. Vary the phrasing -- state a situation, ask "
                f"directly, invert the condition -- rather than one template."
            ),
            question_indices=indices,
        )
    )


def _check_task_depth(questions: list[Any], issues: list[ValidationIssue]) -> None:
    """Whether PROGRAMMING and DIAGRAM questions are actually tasks.

    Both types exist to make a learner build something, and both degrade the
    same way: a one-line prompt with a single test case, or "draw an ERD for a
    library" with nothing to model. The schema enforces that the type-specific
    fields are *present*; this asks whether there is enough there to do.
    """
    thin_programming: list[int] = []
    few_tests: list[int] = []
    thin_diagram: list[int] = []

    for index, question in enumerate(questions):
        question_type = _get(question, "question_type")
        text = (_get(question, "question", "") or "").strip()

        if question_type == "PROGRAMMING":
            if len(text) < MIN_PROGRAMMING_QUESTION_CHARS:
                thin_programming.append(index)
            if len(_get(question, "test_cases", []) or []) < MIN_PROGRAMMING_TEST_CASES:
                few_tests.append(index)

        elif question_type == "DIAGRAM":
            instructions = (_get(question, "instructions", "") or "").strip()
            if (
                len(text) < MIN_DIAGRAM_QUESTION_CHARS
                or len(instructions) < MIN_DIAGRAM_INSTRUCTION_CHARS
            ):
                thin_diagram.append(index)

    if thin_programming:
        issues.append(
            ValidationIssue(
                code="THIN_PROGRAMMING_TASK",
                severity=Severity.WARNING,
                message=(
                    f"{len(thin_programming)} PROGRAMMING question(s) are too short to "
                    f"state a problem, its input and output format, and its constraints."
                ),
                question_indices=thin_programming,
            )
        )
    if few_tests:
        issues.append(
            ValidationIssue(
                code="TOO_FEW_TEST_CASES",
                severity=Severity.WARNING,
                message=(
                    f"{len(few_tests)} PROGRAMMING question(s) have fewer than "
                    f"{MIN_PROGRAMMING_TEST_CASES} test cases, so the edge cases go "
                    f"unchecked."
                ),
                question_indices=few_tests,
            )
        )
    if thin_diagram:
        issues.append(
            ValidationIssue(
                code="THIN_DIAGRAM_TASK",
                severity=Severity.WARNING,
                message=(
                    f"{len(thin_diagram)} DIAGRAM question(s) give too little to model "
                    f"-- a scenario needs entities, relationships and rules, plus a "
                    f"brief of what the diagram must show."
                ),
                question_indices=thin_diagram,
            )
        )


def _check_formatting(questions: list[Any], issues: list[ValidationIssue]) -> None:
    overlong = [
        index
        for index, question in enumerate(questions)
        if len(_get(question, "question", "") or "") > MAX_QUESTION_CHARS
    ]
    if overlong:
        issues.append(
            ValidationIssue(
                code="OVERLONG_QUESTION",
                severity=Severity.WARNING,
                message=f"{len(overlong)} question(s) exceed {MAX_QUESTION_CHARS} characters.",
                question_indices=overlong,
            )
        )


def _check_difficulty_balance(
    questions: list[Any], issues: list[ValidationIssue], stats: dict[str, Any]
) -> None:
    counts = Counter(_get(q, "difficulty", "AVERAGE") for q in questions)
    stats["difficulty"] = dict(counts)
    if not questions:
        return

    dominant, dominant_count = counts.most_common(1)[0]
    share = dominant_count / len(questions)
    if share > 0.8 and len(questions) >= 5:
        issues.append(
            ValidationIssue(
                code="DIFFICULTY_IMBALANCE",
                severity=Severity.WARNING,
                message=(
                    f"{share:.0%} of questions are {dominant}; the batch does not "
                    f"span a useful difficulty range."
                ),
                context={"distribution": dict(counts)},
            )
        )


def _check_bloom_coverage(
    questions: list[Any], issues: list[ValidationIssue], stats: dict[str, Any]
) -> None:
    counts = Counter(_get(q, "bloom_level", "UNDERSTAND") for q in questions)
    stats["bloom"] = dict(counts)
    if len(questions) < 5:
        return

    if len(counts) == 1:
        only = next(iter(counts))
        issues.append(
            ValidationIssue(
                code="BLOOM_SINGLE_LEVEL",
                severity=Severity.WARNING,
                message=(
                    f"Every question sits at Bloom's '{only}'. A useful "
                    f"assessment spans recall through application."
                ),
                context={"distribution": dict(counts)},
            )
        )
        return

    recall_share = (counts.get("REMEMBER", 0)) / len(questions)
    if recall_share > 0.7:
        issues.append(
            ValidationIssue(
                code="BLOOM_RECALL_HEAVY",
                severity=Severity.WARNING,
                message=(
                    f"{recall_share:.0%} of questions are pure recall (REMEMBER); "
                    f"certification exams weight application higher."
                ),
                context={"distribution": dict(counts)},
            )
        )


def _check_objective_alignment(questions: list[Any], issues: list[ValidationIssue]) -> None:
    unmapped = [
        index
        for index, question in enumerate(questions)
        if not (_get(question, "learning_objective", "") or "").strip()
    ]
    if unmapped:
        issues.append(
            ValidationIssue(
                code="UNMAPPED_OBJECTIVE",
                severity=Severity.WARNING,
                message=(
                    f"{len(unmapped)} question(s) are not mapped to a learning "
                    f"objective, so they cannot drive targeted remediation."
                ),
                question_indices=unmapped,
            )
        )


def _check_grounding(questions: list[Any], issues: list[ValidationIssue]) -> None:
    """Ungrounded questions are the hallucination risk: nothing ties them
    back to the source material."""
    ungrounded = [
        index
        for index, question in enumerate(questions)
        if not (_get(question, "source_chunk_ids", []) or [])
    ]
    if ungrounded and len(ungrounded) == len(questions):
        issues.append(
            ValidationIssue(
                code="NO_GROUNDING",
                severity=Severity.INFO,
                message=(
                    "No question cites a source chunk, so grounding cannot be "
                    "verified automatically."
                ),
            )
        )
    elif ungrounded:
        issues.append(
            ValidationIssue(
                code="PARTIALLY_UNGROUNDED",
                severity=Severity.WARNING,
                message=f"{len(ungrounded)} question(s) cite no source material.",
                question_indices=ungrounded,
            )
        )


def _check_expected_count(
    questions: list[Any], expected_count: int | None, issues: list[ValidationIssue]
) -> None:
    if expected_count is None or len(questions) == expected_count:
        return
    issues.append(
        ValidationIssue(
            code="COUNT_MISMATCH",
            severity=Severity.WARNING,
            message=f"Expected {expected_count} questions, got {len(questions)}.",
            context={"expected": expected_count, "actual": len(questions)},
        )
    )


_SEVERITY_PENALTY = {Severity.ERROR: 25, Severity.WARNING: 8, Severity.INFO: 0}


def validate_question_batch(
    questions: Iterable[Any], *, expected_count: int | None = None
) -> ValidationReport:
    """Runs every deterministic check and returns a single report."""
    questions = list(questions)
    issues: list[ValidationIssue] = []
    stats: dict[str, Any] = {"count": len(questions)}

    if not questions:
        return ValidationReport(
            issues=[
                ValidationIssue(
                    code="EMPTY_BATCH",
                    severity=Severity.ERROR,
                    message="The batch contains no questions.",
                )
            ],
            score=0,
            stats=stats,
        )

    stats["types"] = dict(Counter(_get(q, "question_type") for q in questions))

    _check_expected_count(questions, expected_count, issues)
    _check_duplicates(questions, issues)
    _check_explanations(questions, issues)
    _check_distractors(questions, issues)
    _check_answer_positions(questions, issues)
    _check_correct_choice_length(questions, issues)
    _check_stem_variety(questions, issues)
    _check_task_depth(questions, issues)
    _check_formatting(questions, issues)
    _check_difficulty_balance(questions, issues, stats)
    _check_bloom_coverage(questions, issues, stats)
    _check_objective_alignment(questions, issues)
    _check_grounding(questions, issues)

    penalty = sum(_SEVERITY_PENALTY[issue.severity] for issue in issues)
    return ValidationReport(issues=issues, score=max(0, 100 - penalty), stats=stats)
