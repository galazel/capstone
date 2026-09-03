import sys, collections
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()

def profile(lid):
    name, st = db.execute(text(
      "select name, lesson_component_structure from public.lessons where lesson_id=:i"),
      {"i": lid}).fetchone()
    words = 0; multi = 0
    print("\n=== %s (lesson %s) -- %d sections" % (name, lid, len(st)))
    for s in st:
        types = [b.get("type") for b in s.get("content", [])]
        if len(types) > 1: multi += 1
        for b in s.get("content", []):
            d = b.get("data", {})
            words += len(str(d.get("text", "")).split())
            for it in d.get("items", []) or []:
                words += len(str(it.get("text","")).split()) + len(str(it.get("content","")).split()) + len(str(it.get("description","")).split())
            for it in d.get("gridItems", []) or []:
                words += len(str(it.get("description","")).split())
            for it in d.get("cards", []) or []:
                words += len(str(it.get("description","")).split())
            words += len(str(d.get("description","")).split())
    print("   sections with >1 block: %d of %d (%.0f%%)" % (multi, len(st), 100.0*multi/len(st)))
    print("   approx words: %d" % words)
    return words, len(st), multi

tot = 0
for lid in (378, 380, 386):
    w, s, m = profile(lid); tot += w
print("\nexisting average words: %d" % (tot // 3))
tot = 0
for lid in (405, 414, 423):
    w, s, m = profile(lid); tot += w
print("\nmine average words: %d" % (tot // 3))
