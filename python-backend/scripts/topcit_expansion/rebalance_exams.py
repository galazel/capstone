"""Makes every scoped exam draw from every lesson inside its scope.

Nine lessons were added to Understanding of Network and none of their questions
reached the middle or major exams, so a learner sitting "Understanding of
Network Exam" was tested on 5 of the major's 14 lessons. The diagnostic and
mock exams have the same gap at certification scale: 25 of 51 lessons and 32 of
51 respectively.

The repair is a swap, not an append. Each exam has a designed length -- 20
items for a middle exam, 30 for a major, 40 for the diagnostic, 65 for the mock
-- and lengthening them changes the assessment. So a slot for an unrepresented
lesson is taken from a lesson that currently contributes more than one item,
and never from one contributing its only item.

Two constraints make the swap safe rather than arbitrary:

  * The donor is always chosen from the SAME major category as the lesson being
    added. The mock exam's item split across majors was researched against the
    real paper -- Software Development 20%, Database 15%, Network 15%,
    Security 15%, Technical Communications 15%, IT Business 10%, Project
    Management 10% -- and swapping across majors would quietly destroy it.

  * An exam is only lengthened when it is shorter than the number of lessons it
    must cover, which is true of the diagnostic alone: 40 items cannot cover 51
    lessons. It grows to exactly one item per lesson, and its duration grows in
    proportion.

Safe to run because no learner has attempted any of these exams -- verified at
run time, and the script refuses to touch an exam that has attempts.

Dry run by default; --apply writes.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

CERTIFICATION_ID = 13
TYPE_NAMES = {1: "DIAGNOSTIC", 2: "MOCK_EXAM", 3: "MAJOR_EXAM",
              4: "MIDDLE_EXAM"}

#: Minutes per item when an exam has to be lengthened, taken from the
#: diagnostic's own current ratio (60 minutes over 40 items).
MINUTES_PER_ITEM = 1.5


def scope_lessons(db, type_name, middle_id, major_id):
    """The lessons an exam of this type is supposed to be able to ask about."""
    if type_name == "MIDDLE_EXAM":
        rows = db.execute(text("""
            select l.lesson_id, mi.major_category_id
              from public.lessons l
              join public.middle_categories mi
                on mi.middle_category_id = l.middle_category_id
             where l.middle_category_id = :m"""), {"m": middle_id}).fetchall()
    elif type_name == "MAJOR_EXAM":
        rows = db.execute(text("""
            select l.lesson_id, mi.major_category_id
              from public.lessons l
              join public.middle_categories mi
                on mi.middle_category_id = l.middle_category_id
             where mi.major_category_id = :m"""), {"m": major_id}).fetchall()
    else:
        rows = db.execute(text("""
            select l.lesson_id, mi.major_category_id
              from public.lessons l
              join public.middle_categories mi
                on mi.middle_category_id = l.middle_category_id
              join public.major_categories mj
                on mj.major_category_id = mi.major_category_id
             where mj.certification_id = :c"""),
            {"c": CERTIFICATION_ID}).fetchall()
    return {lesson_id: major for lesson_id, major in rows}


def main():
    apply_changes = "--apply" in sys.argv
    db = SessionLocal()
    print("mode: %s\n" % ("APPLY" if apply_changes else "DRY RUN"))

    exams = db.execute(text("""
        select exam_id, title, exam_type_id, total_questions, duration_minutes,
               middle_category_id, major_category_id
          from public.exams
         where certification_id = :c and exam_type_id in (1, 2, 3, 4)
         order by exam_type_id, exam_id"""),
        {"c": CERTIFICATION_ID}).fetchall()

    swaps = additions = grown = 0

    for (exam_id, title, type_id, declared, duration,
         middle_id, major_id) in exams:
        type_name = TYPE_NAMES[type_id]

        attempts = db.execute(text(
            "select count(*) from public.learner_exam_details where exam_id = :e"),
            {"e": exam_id}).scalar()
        if attempts:
            print("%-4s %-46s SKIPPED: %d learner attempt(s) recorded"
                  % (exam_id, title[:46], attempts))
            continue

        lesson_major = scope_lessons(db, type_name, middle_id, major_id)

        current = db.execute(text("""
            select eq.exam_question_id, q.question_id, q.lesson_id
              from public.exam_questions eq
              join public.questions q on q.question_id = eq.question_id
             where eq.exam_id = :e
             order by eq.display_order"""), {"e": exam_id}).fetchall()

        by_lesson = {}
        for exam_question_id, question_id, lesson_id in current:
            by_lesson.setdefault(lesson_id, []).append(exam_question_id)

        missing = [lesson_id for lesson_id in lesson_major
                   if lesson_id not in by_lesson]
        if not missing:
            continue

        print("=" * 74)
        print("%-4s %-14s %-44s %d item(s), %d lesson(s) missing"
              % (exam_id, type_name, title[:44], len(current), len(missing)))

        used_questions = {row[1] for row in current}
        removals = []
        insertions = []

        # An exam too short to hold one item per lesson simply has to grow.
        must_grow = len(current) < len(lesson_major)

        for lesson_id in sorted(missing):
            question_id = db.execute(text("""
                select question_id from public.questions
                 where lesson_id = :l and question_id != all(:used)
                 order by question_id limit 1"""),
                {"l": lesson_id, "used": list(used_questions) or [0]}).scalar()
            if question_id is None:
                print("    lesson %s has no unused question -- skipped"
                      % lesson_id)
                continue
            used_questions.add(question_id)

            donor = None
            if not must_grow:
                # Free a slot from the most over-represented lesson in the same
                # major, so the per-major item split is unchanged.
                target_major = lesson_major[lesson_id]
                candidates = [
                    (len(rows), other)
                    for other, rows in by_lesson.items()
                    if len(rows) > 1 and lesson_major.get(other) == target_major
                ]
                if candidates:
                    _, donor = max(candidates)
                    removals.append(by_lesson[donor].pop())

            insertions.append((lesson_id, question_id, donor))

        # An exam that had to grow is levelled to exactly one item per lesson
        # rather than left at whatever length the additions produced. The
        # diagnostic otherwise lands at 66 items for 51 lessons -- longer than
        # designed AND still lopsided, with some lessons asked about three
        # times and others once.
        if must_grow:
            for lesson_id, rows in by_lesson.items():
                while len(rows) > 1:
                    removals.append(rows.pop())

        for lesson_id, question_id, donor in insertions:
            if donor:
                print("    + q%-6s (lesson %s)  <- slot from lesson %s"
                      % (question_id, lesson_id, donor))
            else:
                print("    + q%-6s (lesson %s)  <- appended"
                      % (question_id, lesson_id))
        if must_grow and removals:
            print("    - %d duplicate item(s) trimmed to leave one per lesson"
                  % len(removals))

        if apply_changes:
            for exam_question_id in removals:
                db.execute(text(
                    "delete from public.exam_questions "
                    "where exam_question_id = :i"), {"i": exam_question_id})
            for _, question_id, _ in insertions:
                db.execute(text("""
                    insert into public.exam_questions
                        (display_order, points, exam_id, question_id)
                    values (0, 1, :e, :q)"""), {"e": exam_id, "q": question_id})

            # display_order is contiguous in this bank; a delete plus an append
            # would leave gaps and a run of zeroes, so it is rewritten.
            rows = db.execute(text(
                "select exam_question_id from public.exam_questions "
                "where exam_id = :e order by display_order, exam_question_id"),
                {"e": exam_id}).fetchall()
            for order, (exam_question_id,) in enumerate(rows, start=1):
                db.execute(text(
                    "update public.exam_questions set display_order = :o "
                    "where exam_question_id = :i"),
                    {"o": order, "i": exam_question_id})

            total = len(rows)
            new_duration = (max(duration, int(total * MINUTES_PER_ITEM))
                            if total > declared else duration)
            db.execute(text("""
                update public.exams
                   set total_questions = :n, duration_minutes = :d,
                       updated_at = now()
                 where exam_id = :e"""),
                {"n": total, "d": new_duration, "e": exam_id})

            if total != declared:
                print("    exam now %d items over %d minutes (was %d/%d)"
                      % (total, new_duration, declared, duration))

        swaps += len(removals)
        additions += len(insertions)
        grown += 1 if must_grow else 0

    print("\n%d question(s) added, %d slot(s) freed by swap, "
          "%d exam(s) lengthened" % (additions, swaps, grown))
    if apply_changes:
        db.commit()
    else:
        print("dry run -- re-run with --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
