import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()

TARGET = 5
rows = db.execute(text("""
 select mj.title, mi.middle_category_id, mi.title,
        (select count(*) from public.lessons l where l.middle_category_id = mi.middle_category_id)
   from public.middle_categories mi
   join public.major_categories mj on mj.major_category_id = mi.major_category_id
  where mj.certification_id = 13
  order by mj.major_category_id, mi.middle_category_id""")).fetchall()

total = 0
by_major = {}
for major, mid, middle, count in rows:
    need = max(0, TARGET - count)
    total += need
    by_major.setdefault(major, []).append((middle, count, need))

for major, items in by_major.items():
    short = sum(n for _, _, n in items)
    print("%-38s needs %2d" % (major, short))
    for middle, count, need in items:
        flag = "OK " if need == 0 else "+%d " % need
        print("    %s %-46s %d/%d" % (flag, middle, count, TARGET))
print("\nlessons to reach %d per middle: %d" % (TARGET, total))
print("current lesson total: %d" % db.execute(text("""
 select count(*) from public.lessons l
  join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
  join public.major_categories mj on mj.major_category_id = mi.major_category_id
 where mj.certification_id = 13""")).scalar())

print("\nEXACT_MATCH short answers with no accepted variations: %s of %s" % (
  db.execute(text("""
   select count(*) from public.text_question_configs c
    join public.questions q on q.question_id = c.question_id
    join public.lessons l on l.lesson_id = q.lesson_id
    join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
    join public.major_categories mj on mj.major_category_id = mi.major_category_id
   where mj.certification_id = 13 and c.checking_method = 'EXACT_MATCH'
     and (c.accepted_variations is null or c.accepted_variations = '')""")).scalar(),
  db.execute(text("""
   select count(*) from public.text_question_configs c
    join public.questions q on q.question_id = c.question_id
    join public.lessons l on l.lesson_id = q.lesson_id
    join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
    join public.major_categories mj on mj.major_category_id = mi.major_category_id
   where mj.certification_id = 13 and c.checking_method = 'EXACT_MATCH'""")).scalar()))

print("\nnew lessons (>=405) whose questions are in a MIDDLE or MAJOR exam:")
print("   %s of 9" % db.execute(text("""
 select count(distinct l.lesson_id) from public.lessons l
  join public.questions q on q.lesson_id = l.lesson_id
  join public.exam_questions eq on eq.question_id = q.question_id
  join public.exams e on e.exam_id = eq.exam_id
 where l.lesson_id >= 405 and e.exam_type_id in (3, 4)""")).scalar())
