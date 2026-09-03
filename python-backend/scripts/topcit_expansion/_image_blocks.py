import sys, json, collections
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
rows = db.execute(text("""
 select l.lesson_id, l.lesson_component_structure from public.lessons l
  join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
  join public.major_categories mj on mj.major_category_id = mi.major_category_id
 where mj.certification_id = 13 and l.lesson_id < 405""")).fetchall()
seen = 0
keys = collections.Counter()
for lid, st in rows:
    for s in st or []:
        for b in s.get("content", []):
            if "image" in (b.get("type") or ""):
                keys[b.get("data", {}).get("imageKey")] += 1
                if seen < 4:
                    print("lesson %s  %s" % (lid, b.get("type")))
                    print(json.dumps(b.get("data"), indent=2)[:500]); print()
                    seen += 1
print("distinct imageKey values: %d" % len(keys))
for k, n in keys.most_common(6):
    print("   %-60s x%d" % (str(k)[:60], n))
