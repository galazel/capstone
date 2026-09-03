import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
rows = db.execute(text("""
 select l.lesson_id, l.name, mi.title, mj.title,
        jsonb_array_length(l.lesson_component_structure),
        (select count(*) from public.questions q where q.lesson_id = l.lesson_id),
        (select e.exam_id from public.exams e where e.lesson_id = l.lesson_id
          and e.exam_type_id = 5 limit 1)
   from public.lessons l
   join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
   join public.major_categories mj on mj.major_category_id = mi.major_category_id
  where l.lesson_id >= 405 order by l.lesson_id""")).fetchall()
cur = None
for lid, name, mid, maj, secs, qs, quiz in rows:
    if maj != cur:
        print("\n== %s" % maj); cur = maj
    print("  lesson %-4s  %-56s %2d sections  %2d questions  quiz %s"
          % (lid, name[:56], secs, qs, quiz))
print("\n%d new lessons" % len(rows))
