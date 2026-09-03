"""Seeds hand-written TOPCIT lessons, their quizzes and their question bank.

Nothing here calls a model. The curriculum was thin -- 42 lessons over 23
middle categories, several of them carrying a single lesson -- and the fix is
written content, not another generation run: the account has no credits for one,
and the last one is what left the gaps.

Everything is idempotent by title. A lesson is skipped if its middle category
already holds one with the same name, a quiz is skipped if an exam with the
same title already exists for that lesson, and a middle category is reused
rather than duplicated. Running the script twice adds nothing the second time,
which matters because these tables are live and learners have progress against
them.

Usage (from the repository root):

    docker compose exec -T python-api \
        python /app/scripts/topcit_expansion/seed.py network_01
"""

import importlib
import json
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

from sqlalchemy import text

from app.db.session import SessionLocal

CERTIFICATION_ID = 13
LESSON_QUIZ_TYPE_ID = 5
QUIZ_PASSING_SCORE = 70

#: What the grader splits `accepted_variations` on. Named rather than inlined
#: because it is a contract with Java code in another service, and a comma here
#: silently disables every variation in the bank.
VARIATION_SEPARATOR = "\n"


def resolve_middle(db, spec):
    """`spec` is either an existing middle_category_id or (major_id, title)."""
    if isinstance(spec, int):
        return spec

    major_id, title = spec
    existing = db.execute(text("""
        select middle_category_id from public.middle_categories
         where major_category_id = :m and title = :t"""),
        {"m": major_id, "t": title}).scalar()
    if existing:
        return existing

    middle_id = db.execute(text("""
        insert into public.middle_categories (title, major_category_id)
        values (:t, :m) returning middle_category_id"""),
        {"t": title, "m": major_id}).scalar()
    print("  + middle category %s  %s" % (middle_id, title))
    return middle_id


def insert_question(db, lesson_id, item):
    question_id = db.execute(text("""
        insert into public.questions
            (question_text, question_type, total_points, difficulty_level,
             lesson_id, created_at)
        values (:t, :qt, :p, :d, :l, now())
        returning question_id"""), {
        "t": item["question"], "qt": item["type"], "p": 1,
        "d": item["difficulty"], "l": lesson_id,
    }).scalar()

    if item["type"] == "MCQ":
        for choice_text, is_correct in item["choices"]:
            db.execute(text("""
                insert into public.choices
                    (choice_text, is_correct, explanation, question_id)
                values (:c, :ok, :e, :q)"""), {
                "c": choice_text, "ok": is_correct,
                # The bank only ever explains the correct choice; a
                # distractor's reason for being wrong belongs in that text.
                "e": item["explanation"] if is_correct else None,
                "q": question_id,
            })

    elif item["type"] in ("SHORT_ANSWER", "DESCRIPTIVE"):
        if item["type"] == "SHORT_ANSWER":
            # Newline-joined, not comma-joined. AssessmentAttemptService's
            # matchesTextAnswer splits accepted variations on a newline, so a
            # comma-joined list is stored as one long string that no learner
            # will ever type and every variation in it is silently dead.
            method = "EXACT_MATCH"
            variations = VARIATION_SEPARATOR.join(item["variations"])
        else:
            method, variations = "AI_SEMANTIC", None
        db.execute(text("""
            insert into public.text_question_configs
                (checking_method, correct_answer, accepted_variations, question_id)
            values (:m, :a, :v, :q)"""), {
            "m": method, "a": item["answer"], "v": variations, "q": question_id,
        })
        for order_index, (name, max_points) in enumerate(item.get("rubric", []), start=1):
            db.execute(text("""
                insert into public.question_rubric_criteria
                    (display_order, max_points, name, question_id)
                values (:o, :mp, :n, :q)"""), {
                "o": order_index, "mp": max_points, "n": name, "q": question_id,
            })

    return question_id


def seed_lesson(db, spec):
    middle_id = resolve_middle(db, spec["middle"])

    existing = db.execute(text("""
        select lesson_id, jsonb_array_length(lesson_component_structure)
          from public.lessons
         where middle_category_id = :m and name = :n"""),
        {"m": middle_id, "n": spec["name"]}).fetchone()

    if existing:
        lesson_id, stored_sections = existing
        new_sections = len(spec["structure"])

        # Section count alone is no longer enough to decide whether a stored
        # lesson is behind. Converting the coloured card grids to plain
        # subheading-and-prose sequences leaves the section count identical
        # while roughly doubling the blocks inside, so a lesson that needs
        # rewriting would otherwise be reported "unchanged".
        stored_blocks = db.execute(text("""
            select coalesce(sum(jsonb_array_length(section -> 'content')), 0)
              from public.lessons l,
                   jsonb_array_elements(l.lesson_component_structure) section
             where l.lesson_id = :i"""), {"i": lesson_id}).scalar()
        new_blocks = sum(len(s["content"]) for s in spec["structure"])

        # A lesson already in the bank is rewritten only when the module has
        # grown it. Content here is revised upward -- sections split finer,
        # more component types added -- and a learner who opens a lesson twice
        # should get the better version. Shrinking is never automatic: that
        # would silently discard material if a module were edited down by
        # accident, and these rows are live.
        if new_sections > stored_sections or new_blocks > stored_blocks:
            db.execute(text("""
                update public.lessons
                   set lesson_component_structure = cast(:s as jsonb)
                 where lesson_id = :i"""),
                {"s": json.dumps(spec["structure"]), "i": lesson_id})
            print("  ~ lesson %-5s %-44s %2d->%2d sections  %3d->%3d blocks"
                  % (lesson_id, spec["name"][:44], stored_sections,
                     new_sections, stored_blocks, new_blocks))
        else:
            print("  = lesson %-5s %-44s %2d sections %3d blocks (unchanged)"
                  % (lesson_id, spec["name"][:44], stored_sections,
                     stored_blocks))
        return lesson_id, 0, False

    lesson_id = db.execute(text("""
        insert into public.lessons (name, middle_category_id, lesson_component_structure)
        values (:n, :m, cast(:s as jsonb)) returning lesson_id"""), {
        "n": spec["name"], "m": middle_id,
        "s": json.dumps(spec["structure"]),
    }).scalar()

    for item in spec["quiz"]:
        insert_question(db, lesson_id, item)

    quiz_title = "%s Quiz" % spec["name"]
    quiz_exists = db.execute(text(
        "select exam_id from public.exams where title = :t and certification_id = :c"),
        {"t": quiz_title, "c": CERTIFICATION_ID}).scalar()

    made_quiz = False
    if not quiz_exists and spec["quiz"]:
        # The quiz takes the same shape as every other LESSON_QUIZ in this
        # certification: published, 70% to pass, scoped to the lesson, and two
        # minutes an item plus a few to read the stem.
        minutes = 2 * len(spec["quiz"]) + 3
        exam_id = db.execute(text("""
            insert into public.exams
                (title, status, target_scope, total_questions, duration_minutes,
                 passing_score, is_generated, certification_id, exam_type_id,
                 lesson_id, published_at, updated_at)
            values (:t, 'PUBLISHED', 'LESSON', :n, :d, :p, false, :c, :et, :l,
                    now(), now())
            returning exam_id"""), {
            "t": quiz_title, "n": len(spec["quiz"]), "d": minutes,
            "p": QUIZ_PASSING_SCORE, "c": CERTIFICATION_ID,
            "et": LESSON_QUIZ_TYPE_ID, "l": lesson_id,
        }).scalar()

        for order, item in enumerate(spec["quiz"], start=1):
            question_id = db.execute(text("""
                select question_id from public.questions
                 where lesson_id = :l and question_text = :t
                 order by question_id desc limit 1"""),
                {"l": lesson_id, "t": item["question"]}).scalar()
            db.execute(text("""
                insert into public.exam_questions (display_order, points, exam_id, question_id)
                values (:o, 1, :e, :q)"""),
                {"o": order, "e": exam_id, "q": question_id})
        made_quiz = True

    print("  + lesson %-5s %-52s %2d sections, %2d questions%s"
          % (lesson_id, spec["name"][:52], len(spec["structure"]),
             len(spec["quiz"]), ", quiz" if made_quiz else ""))
    return lesson_id, len(spec["quiz"]), made_quiz


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    db = SessionLocal()
    total_lessons = total_questions = total_quizzes = 0

    for batch in sys.argv[1:]:
        module = importlib.import_module("content_%s" % batch)
        print("\n== %s: %d lessons" % (batch, len(module.LESSONS)))
        for spec in module.LESSONS:
            _, questions, made_quiz = seed_lesson(db, spec)
            if questions:
                total_lessons += 1
            total_questions += questions
            total_quizzes += 1 if made_quiz else 0

    db.commit()
    print("\nseeded %d lessons, %d questions, %d quizzes"
          % (total_lessons, total_questions, total_quizzes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
