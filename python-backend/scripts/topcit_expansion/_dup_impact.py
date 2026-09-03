"""Shows exactly what is attached to the duplicate questions before any delete.

These rows are live. A question that a learner has already answered cannot be
deleted without destroying that attempt's history, so the decision of which of
a pair to keep has to be made on evidence rather than on which id is lower.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

db = SessionLocal()

PAIRS = [
    (2196, 2504), (2422, 2870), (2654, 2802),
    (2693, 3180), (2978, 3081), (2999, 3193),
]

# Every table that points at questions, so nothing is deleted that something
# else still references.
referencing = db.execute(text("""
    select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
     where tc.constraint_type = 'FOREIGN KEY'
       and ccu.table_name = 'questions'
       and ccu.column_name = 'question_id'
     order by 1""")).fetchall()

print("tables referencing questions.question_id:")
for table, column in referencing:
    print("   %-38s %s" % (table, column))
print()

for left, right in PAIRS:
    print("=" * 72)
    for qid in (left, right):
        row = db.execute(text("""
            select q.question_id, q.question_type, q.total_points,
                   q.difficulty_level, q.created_at, l.name
              from public.questions q
              join public.lessons l on l.lesson_id = q.lesson_id
             where q.question_id = :q"""), {"q": qid}).fetchone()

        exams = db.execute(text("""
            select e.exam_id, e.title, e.status
              from public.exam_questions eq
              join public.exams e on e.exam_id = eq.exam_id
             where eq.question_id = :q"""), {"q": qid}).fetchall()

        counts = {}
        for table, column in referencing:
            counts[table] = db.execute(text(
                "select count(*) from public.%s where %s = :q" % (table, column)),
                {"q": qid}).scalar()

        print("q%-6s %-16s %s pt  %-8s  created %s"
              % (row[0], row[1], row[2], row[3], row[4]))
        print("        lesson: %s" % row[5])
        print("        exams:  %s" % (
            ", ".join("%s %s (%s)" % (e[0], e[1], e[2]) for e in exams) or "none"))
        print("        refs:   %s" % ", ".join(
            "%s=%s" % (t, n) for t, n in sorted(counts.items()) if n))
    print()
