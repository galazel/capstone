"""A run that dies keeps what it generated.

Persisting used to happen once, at the very end of a successful run, so a
failure anywhere along the way -- or an admin stopping a run at lesson 40 --
threw away everything in the checkpoint. Both failure paths now flush what
exists into Java's tables first.

Which only works if writing the same output twice is safe: the rescue writes
what a failed run had, and the retry that finishes later writes the whole lot
again. These tests are mostly about that second write adding nothing.
"""

from __future__ import annotations

import pytest

import app.services.assessment_persistence as persistence
import app.services.certification_run as run


CURRICULUM = {
    "majorCategories": [
        {
            "name": "Major A",
            "middleCategories": [
                {"name": "Middle A1", "lessons": [{"name": "Lesson 1"}, {"name": "Lesson 2"}]}
            ],
        }
    ]
}


class _FakeCurriculumRepo:
    """Enough of `java_backend` for `_persist_curriculum`, backed by lists so
    a second write can see the first one's rows."""

    def __init__(self):
        self.majors: list[dict] = []
        self.middles: list[dict] = []
        self.lessons: list[dict] = []
        self.structures: list = []

    def update_certification_exam_structure(self, session, certification_id, structure):
        self.structures.append(structure)

    def list_certification_major_categories(self, session, certification_id):
        return list(self.majors)

    def list_certification_middle_categories(self, session, certification_id):
        return list(self.middles)

    def list_certification_lessons(self, session, certification_id):
        return list(self.lessons)

    def insert_major_category(self, session, certification_id, title):
        row = {"major_category_id": len(self.majors) + 1, "name": title}
        self.majors.append(row)
        return row["major_category_id"]

    def insert_middle_category(self, session, major_category_id, title):
        row = {
            "middle_category_id": len(self.middles) + 1,
            "name": title,
            "major_category_id": major_category_id,
        }
        self.middles.append(row)
        return row["middle_category_id"]

    def insert_lesson(self, session, middle_category_id, name, blocks=None):
        row = {
            "lesson_id": len(self.lessons) + 1,
            "name": name,
            "middle_category_id": middle_category_id,
        }
        self.lessons.append(row)
        return row["lesson_id"]


class _NullSession:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def commit(self):
        pass


@pytest.fixture()
def curriculum_repo(monkeypatch):
    fake = _FakeCurriculumRepo()
    monkeypatch.setattr(run, "repo", fake)
    monkeypatch.setattr(run, "SessionLocal", _NullSession)
    return fake


def test_the_curriculum_is_written_once_however_often_it_is_persisted(curriculum_repo):
    """The rescue writes what a failed run had; the retry that finishes writes
    the whole tree again. Two majors, four lessons, and a duplicated category
    tree is what that used to produce."""
    run._persist_curriculum(1, CURRICULUM)
    run._persist_curriculum(1, CURRICULUM)

    assert [row["name"] for row in curriculum_repo.majors] == ["Major A"]
    assert [row["name"] for row in curriculum_repo.middles] == ["Middle A1"]
    assert [row["name"] for row in curriculum_repo.lessons] == ["Lesson 1", "Lesson 2"]


def test_a_second_write_fills_in_what_the_first_one_did_not_reach(curriculum_repo):
    """The realistic shape of a retry: the failed run had planned one lesson,
    the finished one has both."""
    partial = {
        "majorCategories": [
            {"name": "Major A", "middleCategories": [
                {"name": "Middle A1", "lessons": [{"name": "Lesson 1"}]}
            ]}
        ]
    }
    run._persist_curriculum(1, partial)
    run._persist_curriculum(1, CURRICULUM)

    assert [row["name"] for row in curriculum_repo.lessons] == ["Lesson 1", "Lesson 2"]


def test_matching_ignores_case_and_spacing(curriculum_repo):
    run._persist_curriculum(1, CURRICULUM)
    run._persist_curriculum(1, {
        "majorCategories": [
            {"name": "  major a ", "middleCategories": [
                {"name": "MIDDLE A1", "lessons": [{"name": "lesson 1"}]}
            ]}
        ]
    })

    assert len(curriculum_repo.majors) == 1
    assert len(curriculum_repo.lessons) == 2


# --- assessments ----------------------------------------------------------


class _FakeAssessmentRepo:
    """`java_backend` as far as `persist_generated_assessments` uses it."""

    def __init__(self, lessons):
        self._lessons = lessons
        self.exams: list[dict] = []
        self.questions: list[dict] = []

    # reads
    def list_certification_lessons(self, session, certification_id):
        return list(self._lessons)

    def list_certification_major_categories(self, session, certification_id):
        return [{"major_category_id": 1, "name": "Major A"}]

    def list_certification_middle_categories(self, session, certification_id):
        return [{"middle_category_id": 1, "name": "Middle A1", "major_category_id": 1}]

    def list_certification_exams(self, session, certification_id):
        return list(self.exams)

    def list_certification_question_texts(self, session, certification_id):
        return [q["question_text"] for q in self.questions]

    def get_exam_type_id(self, session, exam_type_text):
        return 1

    # writes
    def insert_question(self, session, *, lesson_id, question_type, difficulty, question_text, **_):
        self.questions.append({"question_text": question_text, "lesson_id": lesson_id})
        return len(self.questions)

    def insert_choice(self, session, question_id, text, is_correct, explanation=None):
        pass

    def insert_exam(self, session, *, certification_id, title, target_scope=None, **_):
        self.exams.append({"exam_id": len(self.exams) + 1, "title": title, "target_scope": target_scope})
        return len(self.exams)

    def insert_exam_question(self, session, exam_id, question_id, display_order, points=1.0):
        pass

    def update_lesson_content(self, session, lesson_id, blocks):
        pass

    def insert_lesson(self, session, middle_category_id, name, blocks=None):
        row = {"lesson_id": len(self._lessons) + 1, "name": name,
               "middle_category_id": middle_category_id}
        self._lessons.append(row)
        return row["lesson_id"]


def _mcq(text: str) -> dict:
    return {
        "question_type": "MCQ",
        "question": text,
        "choices": ["a", "b", "c", "d"],
        "choice_explanations": ["right", "wrong", "wrong", "wrong"],
        "correct_choice_index": 0,
        "lesson_ref": "Lesson 1",
        "explanation": "why",
        "difficulty": "AVERAGE",
    }


@pytest.fixture()
def assessment_repo(monkeypatch):
    fake = _FakeAssessmentRepo(
        [{"lesson_id": 1, "name": "Lesson 1", "middle_category_id": 1}]
    )
    monkeypatch.setattr(persistence, "repo", fake)
    return fake


def _result() -> dict:
    return {
        "lessons": [{"name": "Lesson 1", "blocks": []}],
        "lesson_quizzes": [{"lesson": "Lesson 1", "questions": [_mcq("What is A?")]}],
        "mock_exam": {"questions": [_mcq("Mock question?")]},
        "question_bank": [_mcq("Bank question?")],
    }


def test_persisting_the_same_run_twice_does_not_duplicate_anything(assessment_repo):
    """A failed run's rescue, then the retry's full save. Duplicated exams
    would show the admin two copies of every quiz -- and duplicated bank
    questions would feed adaptive selection the same item twice."""
    first = persistence.persist_generated_assessments(_NullSession(), 1, _result())
    second = persistence.persist_generated_assessments(_NullSession(), 1, _result())

    assert [exam["title"] for exam in assessment_repo.exams] == ["Lesson 1 Quiz", "Mock Exam"]
    assert len(first["exams"]) == 2 and second["exams"] == []
    assert [q["question_text"] for q in assessment_repo.questions] == [
        "What is A?", "Mock question?", "Bank question?"
    ]


def test_a_re_persist_of_stored_work_is_not_reported_as_a_total_loss(assessment_repo):
    """`_stranded_output` fails a run whose output all vanished. A second save
    that legitimately writes nothing must not look like that."""
    persistence.persist_generated_assessments(_NullSession(), 1, _result())
    second = persistence.persist_generated_assessments(_NullSession(), 1, _result())

    assert run._stranded_output(second) == []


def test_the_second_save_adds_what_the_first_run_had_not_generated(assessment_repo):
    persistence.persist_generated_assessments(_NullSession(), 1, _result())

    finished = _result()
    finished["diagnostic_exam"] = {"questions": [_mcq("Diagnostic question?")]}
    finished["question_bank"].append(_mcq("Second bank question?"))
    persistence.persist_generated_assessments(_NullSession(), 1, finished)

    assert [exam["title"] for exam in assessment_repo.exams] == [
        "Lesson 1 Quiz", "Mock Exam", "Diagnostic Exam"
    ]
    assert "Second bank question?" in [q["question_text"] for q in assessment_repo.questions]


# --- the rescue itself ----------------------------------------------------


async def test_a_failed_run_saves_what_it_had(monkeypatch):
    saved = {}

    async def _snapshot(thread_id):
        return {"curriculum": CURRICULUM, "lessons": [{"name": "Lesson 1", "blocks": []}]}

    def _persist_curriculum(certification_id, curriculum):
        saved["curriculum"] = curriculum

    def _persist_assessments(session, certification_id, values):
        saved["values"] = values
        return {"exams": [1], "bank_questions": 0, "lessons_written": 1, "warnings": []}

    monkeypatch.setattr(run, "_snapshot_values", _snapshot)
    monkeypatch.setattr(run, "_persist_curriculum", _persist_curriculum)
    monkeypatch.setattr(run, "persist_generated_assessments", _persist_assessments)
    monkeypatch.setattr(run, "SessionLocal", _NullSession)

    context = run.RunContext(
        thread_id="t", certification_title="C", certification_id=1, generation_request_id=1
    )
    outcome = await run.rescue_partial_output(context)

    assert outcome == {"saved": True, "lessons": 1, "exams": 1, "bank_questions": 0}
    assert saved["curriculum"] == CURRICULUM


async def test_nothing_is_written_before_a_curriculum_exists(monkeypatch):
    """A run that died during document ingestion has nothing to keep, and the
    empty certification row must not be dressed up as partial output."""
    async def _snapshot(thread_id):
        return {"status": "STARTED"}

    monkeypatch.setattr(run, "_snapshot_values", _snapshot)
    monkeypatch.setattr(run, "_persist_curriculum", lambda *a: pytest.fail("must not write"))

    context = run.RunContext(
        thread_id="t", certification_title="C", certification_id=1, generation_request_id=1
    )
    assert (await run.rescue_partial_output(context))["saved"] is False


async def test_a_rescue_that_cannot_read_the_checkpoint_does_not_raise(monkeypatch):
    """This runs while a run is already failing. Throwing here would replace
    the generation error the admin needs with a persistence one."""
    async def _boom(thread_id):
        raise RuntimeError("checkpointer is down")

    monkeypatch.setattr(run, "_snapshot_values", _boom)

    context = run.RunContext(
        thread_id="t", certification_title="C", certification_id=1, generation_request_id=1
    )
    assert (await run.rescue_partial_output(context))["saved"] is False
