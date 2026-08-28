"""Where the correct answer sits, after generation.

The prompt asks the model to vary it; this is what makes it true. The property
that matters is that shuffling changes only the *position* of the answer --
the question still has the same options, the same right one, and each option
still carries its own explanation.
"""

from __future__ import annotations

import random
from collections import Counter

from app.domain.choice_order import shuffle_batch, shuffle_choices


def _mcq(**overrides) -> dict:
    base = {
        "question_type": "MCQ",
        "question": "Which normal form eliminates transitive dependencies?",
        "choices": ["1NF", "2NF", "3NF", "BCNF"],
        "correct_choice_index": 2,
        "choice_explanations": [
            "1NF only removes repeating groups.",
            "2NF removes partial dependencies on a composite key.",
            "Correct: 3NF targets transitive dependencies.",
            "BCNF is stricter and addresses a different anomaly.",
        ],
        "explanation": "Transitive dependencies are what third normal form removes.",
    }
    base.update(overrides)
    return base


def test_the_correct_answer_moves_with_its_index():
    """The one thing that must never break: whatever `correct_choice_index`
    points at after the shuffle is the same text it pointed at before."""
    question = _mcq()
    for seed in range(50):
        shuffled = shuffle_choices(question, random.Random(seed))
        assert shuffled["choices"][shuffled["correct_choice_index"]] == "3NF"


def test_each_explanation_travels_with_its_choice():
    question = _mcq()
    for seed in range(50):
        shuffled = shuffle_choices(question, random.Random(seed))
        pairs = dict(zip(shuffled["choices"], shuffled["choice_explanations"]))
        assert pairs["3NF"].startswith("Correct:")
        assert pairs["2NF"].startswith("2NF removes partial")


def test_the_same_options_come_back_just_reordered():
    shuffled = shuffle_choices(_mcq(), random.Random(7))
    assert sorted(shuffled["choices"]) == ["1NF", "2NF", "3NF", "BCNF"]
    assert len(shuffled["choice_explanations"]) == 4


def test_everything_else_is_left_alone():
    shuffled = shuffle_choices(_mcq(), random.Random(3))
    assert shuffled["question"] == _mcq()["question"]
    assert shuffled["explanation"] == _mcq()["explanation"]


def test_the_original_question_is_not_mutated():
    """Nodes hand these dicts straight into graph state; mutating in place
    would edit an object the caller still holds."""
    question = _mcq()
    shuffle_choices(question, random.Random(1))
    assert question["choices"] == ["1NF", "2NF", "3NF", "BCNF"]
    assert question["correct_choice_index"] == 2


def test_positions_spread_across_a_batch():
    """The whole point. A model that put every answer at index 2 produces a
    batch whose answers land in all four positions."""
    rng = random.Random(0)
    batch = shuffle_batch([_mcq() for _ in range(200)], rng)
    counts = Counter(q["correct_choice_index"] for q in batch)

    assert set(counts) == {0, 1, 2, 3}
    # Uniform is 50 each; the loose bound keeps this from failing on a
    # legitimately lopsided draw.
    assert all(25 < hits < 75 for hits in counts.values()), counts


def test_non_mcq_questions_are_untouched():
    question = {
        "question_type": "DESCRIPTIVE",
        "question": "Explain normalization.",
        "rubric_answer": "Covers 1NF through 3NF.",
    }
    assert shuffle_choices(question, random.Random(1)) == question


def test_a_question_whose_parts_do_not_line_up_is_left_alone():
    """Permuting an explanation list of the wrong length would attach each
    explanation to some other option -- worse than a predictable position."""
    mismatched = _mcq(choice_explanations=["only one explanation"])
    assert shuffle_choices(mismatched, random.Random(1)) == mismatched


def test_an_out_of_range_index_is_left_alone():
    broken = _mcq(correct_choice_index=9)
    assert shuffle_choices(broken, random.Random(1)) == broken


def test_a_question_with_no_explanations_still_shuffles():
    """Older artifacts and hand-written questions have none; they should still
    get a randomised position."""
    bare = _mcq()
    bare.pop("choice_explanations")
    shuffled = shuffle_choices(bare, random.Random(5))
    assert shuffled["choices"][shuffled["correct_choice_index"]] == "3NF"
    assert "choice_explanations" not in shuffled


def test_generation_shuffles_on_the_way_out():
    """`questions_as_dicts` is the boundary every generated question crosses,
    in both graphs -- so wiring it there is what makes this unavoidable."""
    from app.ai.invocation import questions_as_dicts
    from app.schemas.certification.question_schema import QuestionBatch, QuestionDraft

    drafts = [
        QuestionDraft(
            question_type="MCQ",
            question=f"Which option is correct in case {i}?",
            choices=["right", "wrong one", "wrong two", "wrong three"],
            correct_choice_index=0,
            choice_explanations=[
                "Correct: this is the defined term.",
                "Wrong: confuses it with a sibling concept.",
                "Wrong: describes a later stage.",
                "Wrong: unrelated to this topic.",
            ],
            explanation="A sufficiently detailed explanation of the answer.",
        )
        for i in range(40)
    ]

    questions = questions_as_dicts(QuestionBatch(scope="s", questions=drafts))

    assert all(q["choices"][q["correct_choice_index"]] == "right" for q in questions)
    assert len({q["correct_choice_index"] for q in questions}) > 1, (
        "every answer still sits in the same position"
    )
