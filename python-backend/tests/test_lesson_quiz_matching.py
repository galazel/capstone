"""A lesson quiz must land on the lesson it was written for.

On 2026-09-01 the "E-Business and Electronic Commerce" quiz was filed against
lesson 1 ("Management Principles"), leaving lesson 1 with two quizzes and
E-Business with none -- which surfaced only as a publishing requirement that
could not be satisfied.

The cause was two different normalisers for one lookup: `build_lesson_index`
keys on `normalize_lesson_name` (which strips punctuation via a word-character regex), while the
quiz lookup used `" ".join(name.lower().split())` (which keeps it). Any lesson
name with a hyphen, ampersand, slash or apostrophe could therefore never match
its own index entry, and the miss fell through silently to `lessons[0]`.
"""

from __future__ import annotations

import pytest

from app.domain.persistence import build_lesson_index, normalize_lesson_name


PUNCTUATED = [
    "E-Business and Electronic Commerce",
    "Research & Development Management",
    "Input/Output Devices",
    "The Developer's Toolkit",
]


@pytest.mark.parametrize("name", PUNCTUATED)
def test_a_punctuated_lesson_name_resolves_to_itself(name):
    """The regression, stated directly: index and lookup must agree."""
    index = build_lesson_index([{"name": name, "lesson_id": 42}])

    assert index.get(normalize_lesson_name(name)) == 42


@pytest.mark.parametrize("name", PUNCTUATED)
def test_the_old_lookup_would_have_missed(name):
    """Pins WHY it broke, so the two normalisers are never split again.

    If this ever fails, the whitespace-only normalisation has become equivalent
    to the real one and this guard is no longer meaningful.
    """
    index = build_lesson_index([{"name": name, "lesson_id": 42}])
    naive_key = " ".join(name.lower().split())

    assert index.get(naive_key) is None


def test_plain_names_were_never_affected():
    """Only punctuated names broke, which is why exactly one quiz was misfiled."""
    name = "Service Management Frameworks and SLA"
    index = build_lesson_index([{"name": name, "lesson_id": 7}])

    assert index.get(" ".join(name.lower().split())) == 7
    assert index.get(normalize_lesson_name(name)) == 7


def test_every_lesson_in_a_curriculum_resolves_uniquely():
    """No two lessons may collapse onto one key, or a quiz lands on the wrong one."""
    names = [
        "E-Business and Electronic Commerce",
        "Management Principles and Organizational Structures",
        "Information Security Measures and Technologies",
    ]
    lessons = [{"name": n, "lesson_id": i + 1} for i, n in enumerate(names)]
    index = build_lesson_index(lessons)

    assert len(index) == len(names)
    for i, name in enumerate(names):
        assert index[normalize_lesson_name(name)] == i + 1
