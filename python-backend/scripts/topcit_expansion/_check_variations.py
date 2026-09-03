import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
rows = db.execute(text("""
 select q.question_id, c.correct_answer, c.accepted_variations
   from public.text_question_configs c
   join public.questions q on q.question_id = c.question_id
   join public.lessons l on l.lesson_id = q.lesson_id
   join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
   join public.major_categories mj on mj.major_category_id = mi.major_category_id
  where mj.certification_id = 13 and c.checking_method = 'EXACT_MATCH'
    and c.accepted_variations is not null and c.accepted_variations <> ''
  order by q.question_id""")).fetchall()
comma_only = 0
for qid, ans, var in rows:
    has_nl = "\n" in var
    if not has_nl and "," in var:
        comma_only += 1
    print("q%-6s nl=%-5s answer=%-34s variations=%r" % (qid, has_nl, ans[:34], var[:90]))
print("\ntotal with variations: %d | comma-separated only (broken): %d" % (len(rows), comma_only))
