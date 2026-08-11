"""Re-links generated MIDDLE/MAJOR exams to their category.

`persist_generated_assessments` used to save these with a null
`middle_category_id`/`major_category_id`. Java's publish checklist derives
coverage purely from those FKs (`buildPublishRequirements` in
CertificationService), so a fully-populated generated exam still shows as
"Not created yet" and the admin is prompted to create a duplicate.

The exam title is `"<Category Name> Exam"`, which is how an existing row is
matched back to its category. Only rows whose FK is currently null are
touched, and only when the name resolves unambiguously.

    python scripts/repair_exam_scope_links.py            # preview only
    python scripts/repair_exam_scope_links.py --apply    # write
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.db.session import SessionLocal
from app.domain.persistence import build_name_index, resolve_category_id
from app.repositories import java_backend as repo

SCOPES = {
    "MIDDLE": ("middle_category_id", repo.list_certification_middle_categories),
    "MAJOR": ("major_category_id", repo.list_certification_major_categories),
}


def main(apply: bool) -> int:
    fixed = 0

    with SessionLocal() as session:
        rows = session.execute(
            text(
                "SELECT e.exam_id, e.certification_id, e.title, e.target_scope "
                "FROM exams e "
                "WHERE e.target_scope IN ('MIDDLE', 'MAJOR') "
                "  AND e.middle_category_id IS NULL "
                "  AND e.major_category_id IS NULL "
                "ORDER BY e.certification_id, e.exam_id"
            )
        ).mappings().all()

        indexes: dict[tuple[int, str], dict[str, int]] = {}

        for row in rows:
            column, lister = SCOPES[row["target_scope"]]
            cache_key = (row["certification_id"], row["target_scope"])
            if cache_key not in indexes:
                indexes[cache_key] = build_name_index(
                    lister(session, row["certification_id"]), column
                )

            # Titles are written as "<Category Name> Exam".
            name = row["title"].removesuffix(" Exam")
            category_id = resolve_category_id(name, indexes[cache_key])

            if category_id is None:
                print(
                    f"  SKIP exam {row['exam_id']} '{row['title']}' "
                    f"({row['target_scope']}) -- no unambiguous category match"
                )
                continue

            print(
                f"  FIX  exam {row['exam_id']} '{row['title']}' "
                f"({row['target_scope']}) -> {column}={category_id}"
            )

            if apply:
                session.execute(
                    text(f"UPDATE exams SET {column} = :cid WHERE exam_id = :id"),
                    {"cid": category_id, "id": row["exam_id"]},
                )
            fixed += 1

        if apply:
            session.commit()

    print(f"\n{'Re-linked' if apply else 'Would re-link'} {fixed} exam(s).")
    if not apply and fixed:
        print("Re-run with --apply to write.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--apply" in sys.argv))
