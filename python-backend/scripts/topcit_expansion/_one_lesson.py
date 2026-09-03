import sys, collections
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
lid = int(sys.argv[1])
name, st = db.execute(text(
  "select name, lesson_component_structure from public.lessons where lesson_id=:i"),
  {"i": lid}).fetchone()
c = collections.Counter()
print("%s (lesson %s) -- %d sections\n" % (name, lid, len(st)))
for s in st:
    types = [b.get("type") for b in s.get("content", [])]
    for t in types: c[t] += 1
    print("   %-52s %s" % (s.get("sectionName")[:52], ", ".join(types)))
print("\nblock mix:")
for t, n in c.most_common():
    print("   %-22s %3d" % (t, n))
