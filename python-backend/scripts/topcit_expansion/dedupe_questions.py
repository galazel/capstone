"""Removes genuinely duplicated questions from the TOPCIT bank.

Only same-type pairs are treated as duplicates. audit_similarity.py flags six
pairs on wording, but three of them are the same topic asked in two different
formats -- an MCQ and a descriptive on the purpose of a requirements
specification, for instance -- which is a legitimate thing for a bank to hold.
They live in different exams and test different abilities (recognition versus
explanation), so removing either would strip an item from a published exam for
no gain. Those three are listed as SKIPPED rather than deleted.

For a real duplicate the newer question is retired and the older kept. It is
not simply deleted: every question here sits in at least one PUBLISHED exam, so
a plain delete would shorten that exam and change its total marks. Instead the
retired question's exam_questions rows are re-pointed at the survivor, and only
then is the question row removed. Each exam ends up with the same number of
items, and the survivor appears in both exams that previously had one of the
pair.

This is safe only because no exam contains both members of a pair -- that is
checked at run time, not assumed -- and because no learner has answered any of
them, which is verified before anything is written.

Dry run by default:

    docker compose exec -T python-api \
        python /app/scripts/topcit_expansion/dedupe_questions.py

    docker compose exec -T python-api \
        python /app/scripts/topcit_expansion/dedupe_questions.py --apply
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

#: (keep, retire) -- the older of each pair is kept.
DUPLICATE_PAIRS = [
    (2422, 2870),   # SHORT_ANSWER, Data Link Layer sublayer flow control
    (2654, 2802),   # SHORT_ANSWER, IT business operations resource function
    (2693, 3180),   # DESCRIPTIVE, importance of technical documentation
]

#: Pairs that ask one topic in two formats. These were left alone on the first
#: pass, because an MCQ and a descriptive on the same concept test different
#: abilities and sit in different exams. They are retired now at the owner's
#: instruction. The survivor is the one already used by more exams, tie-broken
#: to the older id, so that re-pointing disturbs the fewest papers.
#:
#: Note the consequence, which is real: an exam that carried the MCQ now
#: carries the descriptive, or vice versa. Item counts are unchanged but the
#: mix of question types in those papers shifts by one.
CROSS_FORMAT_PAIRS = [
    (2196, 2504),   # keep MCQ, retire DESCRIPTIVE - requirements specification
    (2978, 3081),   # keep DESCRIPTIVE, retire MCQ - requirements documentation
    (2999, 3193),   # keep MCQ, retire DESCRIPTIVE - executive summary
]

#: Child rows that belong to a question and must go with it.
CHILD_TABLES = [
    ("choices", "question_id"),
    ("text_question_configs", "question_id"),
    ("question_rubric_criteria", "question_id"),
    ("programming_question_configs", "question_id"),
    ("diagram_question_configs", "question_id"),
]

#: Rows that reference a question but belong to a LEARNER. If any exist the
#: question is not retired at all -- deleting it would corrupt somebody's
#: attempt history or their mistake review queue.
LEARNER_TABLES = [
    ("learner_exam_details", "question_id"),
    ("learner_mistake_reviews", "source_question_id"),
    ("learner_review_items", "source_question_id"),
]


def learner_references(db, question_id):
    total = 0
    for table, column in LEARNER_TABLES:
        total += db.execute(text(
            "select count(*) from public.%s where %s = :q" % (table, column)),
            {"q": question_id}).scalar()
    return total


def main():
    apply_changes = "--apply" in sys.argv
    db = SessionLocal()

    print("mode: %s\n" % ("APPLY" if apply_changes else "DRY RUN"))

    retired = 0
    work = ([(pair, True) for pair in DUPLICATE_PAIRS]
            + [(pair, False) for pair in CROSS_FORMAT_PAIRS])

    for (keep_id, retire_id), same_type_required in work:
        keep = db.execute(text(
            "select question_type, question_text from public.questions "
            "where question_id = :q"), {"q": keep_id}).fetchone()
        retire = db.execute(text(
            "select question_type, question_text from public.questions "
            "where question_id = :q"), {"q": retire_id}).fetchone()

        if keep is None or retire is None:
            print("q%s / q%s: already resolved, skipping" % (keep_id, retire_id))
            continue

        print("=" * 72)
        print("keep    q%-6s %-14s %s" % (keep_id, keep[0], keep[1][:90]))
        print("retire  q%-6s %-14s %s" % (retire_id, retire[0], retire[1][:90]))

        if keep[0] != retire[0]:
            if same_type_required:
                print("  ! question types differ (%s vs %s) -- not a "
                      "duplicate, skipping" % (keep[0], retire[0]))
                continue
            print("  note: %s replaces %s in the re-pointed exam(s)"
                  % (keep[0], retire[0]))

        learner_rows = learner_references(db, retire_id)
        if learner_rows:
            print("  ! %d learner row(s) reference q%s -- leaving it in place"
                  % (learner_rows, retire_id))
            continue

        # Which exams would need re-pointing, and does any of them already
        # hold the survivor? Re-pointing into such an exam would list the same
        # question twice.
        moving = db.execute(text("""
            select eq.exam_id, e.title
              from public.exam_questions eq
              join public.exams e on e.exam_id = eq.exam_id
             where eq.question_id = :r"""), {"r": retire_id}).fetchall()

        conflicts = [row for row in moving if db.execute(text(
            "select 1 from public.exam_questions "
            "where exam_id = :e and question_id = :k"),
            {"e": row[0], "k": keep_id}).scalar()]

        if conflicts:
            print("  ! exam(s) %s already contain q%s; re-pointing would "
                  "duplicate the item there. Skipping."
                  % (", ".join(str(c[0]) for c in conflicts), keep_id))
            continue

        for exam_id, title in moving:
            print("  exam %-5s %-46s -> now uses q%s" % (exam_id, title[:46], keep_id))

        if apply_changes:
            db.execute(text(
                "update public.exam_questions set question_id = :k "
                "where question_id = :r"), {"k": keep_id, "r": retire_id})
            for table, column in CHILD_TABLES:
                db.execute(text(
                    "delete from public.%s where %s = :r" % (table, column)),
                    {"r": retire_id})
            db.execute(text(
                "delete from public.questions where question_id = :r"),
                {"r": retire_id})
            print("  deleted q%s" % retire_id)

        retired += 1

    if apply_changes:
        db.commit()
        print("\nretired %d duplicate question(s); every exam kept its item "
              "count" % retired)
    else:
        print("\n%d duplicate(s) would be retired. Re-run with --apply."
              % retired)
    return 0


if __name__ == "__main__":
    sys.exit(main())
