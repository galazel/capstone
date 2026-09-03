import sys, collections
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()

def mix(where):
    rows = db.execute(text("""
     select l.lesson_id, l.lesson_component_structure from public.lessons l
      join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
      join public.major_categories mj on mj.major_category_id = mi.major_category_id
     where mj.certification_id = 13 and """ + where)).fetchall()
    c = collections.Counter(); lessons = len(rows); total = 0
    for lid, st in rows:
        for s in st or []:
            for b in s.get("content", []):
                c[b.get("type")] += 1; total += 1
    return lessons, total, c

for label, where in [("EXISTING (pre-expansion)", "l.lesson_id < 405"),
                     ("MINE (405+)", "l.lesson_id >= 405")]:
    lessons, total, c = mix(where)
    print("\n%s -- %d lessons, %d blocks, %.1f blocks/lesson"
          % (label, lessons, total, total / max(lessons, 1)))
    for t, n in c.most_common():
        print("   %-26s %5d  %5.1f%%  %.2f per lesson"
              % (t, n, 100.0 * n / total, n / lessons))
