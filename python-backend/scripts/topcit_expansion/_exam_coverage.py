"""Reports which lessons each scoped exam actually draws questions from."""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

CERTIFICATION_ID = 13
db = SessionLocal()

print("learner attempts recorded against cert-13 exams: %s" % db.execute(text("""
 select count(*) from public.learner_exam_details d
  join public.exams e on e.exam_id = d.exam_id
 where e.certification_id = :c"""), {"c": CERTIFICATION_ID}).scalar())
print()

exams = db.execute(text("""
 select e.exam_id, e.title, e.exam_type_id, e.target_scope, e.total_questions,
        e.middle_category_id, e.major_category_id, e.lesson_id
   from public.exams e
  where e.certification_id = :c and e.exam_type_id in (1, 2, 3, 4)
  order by e.exam_type_id, e.exam_id"""), {"c": CERTIFICATION_ID}).fetchall()

TYPE_NAMES = {1: "DIAGNOSTIC", 2: "MOCK_EXAM", 3: "MAJOR_EXAM",
              4: "MIDDLE_EXAM"}

for (exam_id, title, type_id, scope, declared,
     middle_id, major_id, lesson_id) in exams:
    type_name = TYPE_NAMES[type_id]

    if type_name == "MIDDLE_EXAM":
        in_scope = db.execute(text(
            "select lesson_id from public.lessons where middle_category_id = :m"),
            {"m": middle_id}).fetchall()
    elif type_name == "MAJOR_EXAM":
        in_scope = db.execute(text("""
            select l.lesson_id from public.lessons l
              join public.middle_categories mi
                on mi.middle_category_id = l.middle_category_id
             where mi.major_category_id = :m"""), {"m": major_id}).fetchall()
    else:
        in_scope = db.execute(text("""
            select l.lesson_id from public.lessons l
              join public.middle_categories mi
                on mi.middle_category_id = l.middle_category_id
              join public.major_categories mj
                on mj.major_category_id = mi.major_category_id
             where mj.certification_id = :c"""),
            {"c": CERTIFICATION_ID}).fetchall()

    in_scope = {row[0] for row in in_scope}
    covered = {row[0] for row in db.execute(text("""
        select distinct q.lesson_id from public.exam_questions eq
          join public.questions q on q.question_id = eq.question_id
         where eq.exam_id = :e"""), {"e": exam_id}).fetchall()}

    actual = db.execute(text(
        "select count(*) from public.exam_questions where exam_id = :e"),
        {"e": exam_id}).scalar()

    gap = in_scope - covered
    flag = "" if not gap else "  <-- %d lesson(s) unrepresented" % len(gap)
    print("%-4s %-14s %-46s items %2d/%-2d  lessons %2d/%-2d%s"
          % (exam_id, type_name, title[:46], actual, declared,
             len(covered & in_scope), len(in_scope), flag))
