"""Prints the TOPCIT curriculum tree, marking lessons this expansion added."""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

# Lessons that existed before the expansion started. Anything above this id was
# added by scripts in this directory.
FIRST_NEW_LESSON_ID = 405

db = SessionLocal()

rows = db.execute(text("""
 select mj.major_category_id, mj.title, mi.middle_category_id, mi.title,
        l.lesson_id, l.name,
        (select count(*) from public.lessons x
          where x.middle_category_id = mi.middle_category_id)
   from public.major_categories mj
   join public.middle_categories mi
     on mi.major_category_id = mj.major_category_id
   left join public.lessons l
     on l.middle_category_id = mi.middle_category_id
  where mj.certification_id = 13
  order by mj.major_category_id, mi.middle_category_id, l.lesson_id
""")).fetchall()

current_major = current_middle = None
for major_id, major, middle_id, middle, lesson_id, lesson, count in rows:
    if major_id != current_major:
        print("\n%s (major %s)" % (major, major_id))
        current_major = major_id
    if middle_id != current_middle:
        print("  %-46s (middle %s, %d lessons)" % (middle, middle_id, count))
        current_middle = middle_id
    if lesson_id:
        mark = "NEW" if lesson_id >= FIRST_NEW_LESSON_ID else "   "
        print("      %s %-5s %s" % (mark, lesson_id, lesson))

print("\nmiddle categories: %d" % db.execute(text("""
 select count(*) from public.middle_categories mi
  join public.major_categories mj on mj.major_category_id = mi.major_category_id
 where mj.certification_id = 13""")).scalar())
