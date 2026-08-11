"""Repairs lessons stored as a flat block list instead of editor sections.

Generated lessons written before `build_lesson_sections` existed were saved as
the lesson agent emitted them -- a flat array of content blocks. Both the admin
editor and the learner viewer read `lesson_component_structure` as a list of
sections and render `section.content`, so those lessons show up as a stack of
empty "Untitled section" cards.

This regroups the blocks in place. Nothing is dropped: every block ends up
inside a section, and lessons already in section shape are left alone.

    python scripts/repair_lesson_sections.py            # preview only
    python scripts/repair_lesson_sections.py --apply    # write
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.db.session import SessionLocal
from app.domain.persistence import build_lesson_sections


def main(apply: bool) -> int:
    repaired = 0

    with SessionLocal() as session:
        rows = session.execute(
            text(
                "SELECT lesson_id, name, lesson_component_structure "
                "FROM lessons "
                "WHERE jsonb_typeof(lesson_component_structure) = 'array' "
                "ORDER BY lesson_id"
            )
        ).mappings().all()

        for row in rows:
            blocks = row["lesson_component_structure"] or []
            sections = build_lesson_sections(blocks)

            if sections == blocks:
                print(f"  ok   lesson {row['lesson_id']} '{row['name']}' -- already sectioned")
                continue

            print(
                f"  FIX  lesson {row['lesson_id']} '{row['name']}': "
                f"{len(blocks)} flat block(s) -> {len(sections)} section(s)"
            )
            for section in sections:
                print(f"         - {section['sectionName'] or '(unnamed)'}"
                      f" ({len(section['content'])} block(s))")

            if apply:
                session.execute(
                    text(
                        "UPDATE lessons SET lesson_component_structure = CAST(:s AS jsonb) "
                        "WHERE lesson_id = :id"
                    ),
                    {"s": __import__("json").dumps(sections), "id": row["lesson_id"]},
                )
            repaired += 1

        if apply:
            session.commit()

    print(f"\n{'Repaired' if apply else 'Would repair'} {repaired} lesson(s).")
    if not apply and repaired:
        print("Re-run with --apply to write.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--apply" in sys.argv))
