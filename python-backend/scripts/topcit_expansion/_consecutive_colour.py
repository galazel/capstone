import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()

# Blocks the renderer draws as coloured/accented cards rather than plain prose.
COLOURED = {"accordion", "tabs", "header-description-grid", "review-card-grid",
            "flip-grid", "content-accordion-block", "content-tabs-block",
            "image-feature-grid", "intro-image-card"}

def scan(where, label):
    rows = db.execute(text("""
     select l.lesson_id, l.name, l.lesson_component_structure from public.lessons l
      join public.middle_categories mi on mi.middle_category_id = l.middle_category_id
      join public.major_categories mj on mj.major_category_id = mi.major_category_id
     where mj.certification_id = 13 and """ + where + " order by l.lesson_id")).fetchall()
    runs = 0; lessons_with = 0
    for lid, name, st in rows:
        flat = []
        for s in st or []:
            for b in s.get("content", []):
                flat.append((s.get("sectionName"), b.get("type")))
        found = []
        i = 0
        while i < len(flat) - 1:
            if flat[i][1] in COLOURED and flat[i+1][1] in COLOURED:
                found.append((flat[i], flat[i+1])); runs += 1
            i += 1
        if found:
            lessons_with += 1
            print("  lesson %-4s %-42s" % (lid, name[:42]))
            for a, b in found[:3]:
                print("      %s [%s]  ->  %s [%s]" % (a[0][:26], a[1], b[0][:26], b[1]))
    print("%s: %d consecutive pair(s) across %d of %d lessons\n"
          % (label, runs, lessons_with, len(rows)))

scan("l.lesson_id < 405", "EXISTING")
scan("l.lesson_id >= 405", "MINE")
