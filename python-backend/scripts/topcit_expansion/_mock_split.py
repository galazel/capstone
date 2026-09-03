import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
TARGET = {"Software Development": 20, "Database Construction and Management": 15,
          "Understanding of Network": 15, "Understanding of Security": 15,
          "Technical Communications": 15, "Understanding of IT Business": 10,
          "Project Management": 10}
rows = db.execute(text("""
 select mj.title, count(*) from public.exam_questions eq
  join public.questions q on q.question_id = eq.question_id
  join public.lessons l on l.lesson_id = q.lesson_id
  join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
  join public.major_categories mj on mj.major_category_id = mi.major_category_id
 where eq.exam_id = 192 group by 1 order by 2 desc""")).fetchall()
total = sum(c for _, c in rows)
print("TOPCIT Mock Exam: %d items\n" % total)
for title, count in rows:
    pct = 100.0 * count / total
    tgt = TARGET.get(title, 0)
    print("  %-40s %2d items  %4.1f%%  (target %d%%, delta %+.1f)" % (title, count, pct, tgt, pct - tgt))
