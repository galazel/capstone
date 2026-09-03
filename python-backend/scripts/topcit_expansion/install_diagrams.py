"""Writes the drawn figures into the frontend and points the lessons at them.

Replaces the hotlinked `imageKey` of every hand-written lesson with a
root-relative path to an SVG we ship ourselves. `imageSourceUrl` is cleared:
the renderer only shows an attribution line when a source URL is present, and
there is nothing external left to credit.

Usage:
    docker compose exec -T python-api python /app/scripts/topcit_expansion/install_diagrams.py
    docker compose exec -T python-api python /app/scripts/topcit_expansion/install_diagrams.py --apply
"""

import json
import os
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

from sqlalchemy import text

from app.db.session import SessionLocal
from diagrams import DIAGRAMS
from fix_images import image_slots

#: Mounted from the repository so the generated files land in the frontend.
OUTPUT_DIR = "/app/scripts/topcit_expansion/_generated_svg"
PUBLIC_PATH = "/lesson-media/%s.svg"


def main():
    apply = "--apply" in sys.argv
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for slug, svg in DIAGRAMS.values():
        with open(os.path.join(OUTPUT_DIR, slug + ".svg"), "w", encoding="utf-8") as handle:
            handle.write(svg)
    print("wrote %d svg file(s) to %s\n" % (len(DIAGRAMS), OUTPUT_DIR))

    db = SessionLocal()
    rows = db.execute(text("""
        SELECT l.lesson_id, l.name, l.lesson_component_structure
        FROM public.lessons l
        JOIN public.middle_categories mi ON mi.middle_category_id = l.middle_category_id
        JOIN public.major_categories mj ON mj.major_category_id = mi.major_category_id
        WHERE mj.certification_id = 13 AND l.lesson_id >= 405
        ORDER BY l.lesson_id
    """)).fetchall()

    matched = missed = 0
    used = set()
    for lesson_id, lesson_name, structure in rows:
        if isinstance(structure, str):
            structure = json.loads(structure)
        changed = False
        for section_name, slot in image_slots(structure):
            entry = DIAGRAMS.get((lesson_id, section_name))
            if not entry:
                print("  MISSING  %d  %s" % (lesson_id, section_name))
                missed += 1
                continue
            slug, _svg = entry
            used.add((lesson_id, section_name))
            slot["imageKey"] = PUBLIC_PATH % slug
            slot["imageSourceUrl"] = None
            slot["imageSourceName"] = None
            changed = True
            matched += 1
            print("  %d  %-44s -> %s" % (lesson_id, section_name[:44], slug))
        if changed and apply:
            db.execute(
                text("UPDATE public.lessons "
                     "SET lesson_component_structure = CAST(:body AS jsonb) "
                     "WHERE lesson_id = :lesson_id"),
                {"body": json.dumps(structure), "lesson_id": lesson_id},
            )

    if apply:
        db.commit()
    db.close()

    unused = set(DIAGRAMS) - used
    for key in sorted(unused):
        print("  UNUSED   %s" % (key,))

    print("\nmatched %d | missing %d | unused %d%s"
          % (matched, missed, len(unused), "" if apply else "   (dry run)"))


if __name__ == "__main__":
    main()
