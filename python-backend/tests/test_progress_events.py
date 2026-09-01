"""Node events carry enough to draw a progress bar, not just a spinner.

A twenty-lesson build is an hour of watching a transcript scroll, and the
question the admin actually has is "how much is left". Answering it needs a
denominator, which only exists once the curriculum has been planned -- so the
plan rides on every instrumented event from that point on rather than being
announced once. A client that attaches halfway through a run replays from a
cursor and would otherwise never see the announcement, leaving it permanently
indeterminate for the people most likely to be checking in.
"""

from __future__ import annotations

from app.graphs.certification.state import curriculum_totals
from app.graphs.instrumentation import _progress_context


def _curriculum(majors: int = 2, middles: int = 2, lessons: int = 3) -> dict:
    return {
        "majorCategories": [
            {
                "name": f"major-{m}",
                "middleCategories": [
                    {
                        "name": f"middle-{m}-{d}",
                        "lessons": [{"name": f"lesson-{m}-{d}-{i}"} for i in range(lessons)],
                    }
                    for d in range(middles)
                ],
            }
            for m in range(majors)
        ]
    }


class TestCurriculumTotals:
    def test_counts_every_level_of_the_nesting(self):
        assert curriculum_totals(_curriculum(2, 2, 3)) == {
            "majors": 2,
            "middles": 4,
            "lessons": 12,
        }

    def test_no_curriculum_is_zero_rather_than_an_error(self):
        assert curriculum_totals(None) == {"majors": 0, "middles": 0, "lessons": 0}
        assert curriculum_totals({})["lessons"] == 0


class TestProgressContext:
    def test_per_item_stages_report_which_item_of_how_many(self):
        context = _progress_context(
            {"curriculum": _curriculum(), "lesson_cursor": 5}, "lesson_content"
        )

        assert context["item_number"] == 6
        assert context["item_total"] == 12

    def test_once_per_run_stages_carry_the_plan_but_no_item(self):
        context = _progress_context({"curriculum": _curriculum()}, "generate_mock_exam")

        assert context["plan"]["lessons"] == 12
        assert "item_number" not in context

    def test_the_curriculum_node_reports_the_plan_it_just_produced(self):
        # The wrapper only sees the state from *before* the node ran, where
        # there is no curriculum yet. Without reading the result, the first
        # event carrying a denominator would be the next node's -- so the bar
        # stayed indeterminate through a review pause that can last hours.
        context = _progress_context({}, "plan_curriculum", {"curriculum": _curriculum()})

        assert context["plan"] == {"majors": 2, "middles": 4, "lessons": 12}

    def test_nothing_to_say_before_the_curriculum_exists(self):
        assert _progress_context({}, "validate_documents") is None

    def test_an_item_with_no_plan_still_reports_its_position(self):
        # A run resumed from a checkpoint whose curriculum did not survive
        # should still say "lesson 4", just without the "of 12".
        context = _progress_context({"lesson_cursor": 3}, "lesson_validate")

        assert context == {"item_index": 3, "item_number": 4}
