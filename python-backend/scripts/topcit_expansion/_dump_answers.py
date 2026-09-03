import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
rows = db.execute(text("""
 select q.question_id, c.correct_answer
   from public.text_question_configs c
   join public.questions q on q.question_id = c.question_id
   join public.lessons l on l.lesson_id = q.lesson_id
   join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
   join public.major_categories mj on mj.major_category_id = mi.major_category_id
  where mj.certification_id = 13 and c.checking_method = 'EXACT_MATCH'
    and (c.accepted_variations is null or c.accepted_variations = '')
  order by q.question_id""")).fetchall()
for qid, ans in rows:
    print("%s|%s" % (qid, ans))
print("total", len(rows))
