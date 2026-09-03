"""Renames lessons whose titles collide with another lesson's.

The audit found "Software Testing and Quality Assurance" (Software
Implementation and Testing) and "Quality Assurance and Testing" (Project
Quality and Support) 75% alike by name while sharing none of their subject
matter. That is the worst combination: a learner searching the catalogue
cannot tell them apart, and the one they pick may be from the wrong major
entirely.

The Software Development one keeps its name, because "Software Testing and
Quality Assurance" describes its content precisely. The Project Management one
is renamed to say what it actually covers -- quality management as a project
discipline, not software test technique.

The lesson's own quiz is renamed with it. A quiz titled after the old lesson
name is the same navigation problem one level down.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

#: (lesson_id, old name, new name)
RENAMES = [
    (401,
     "Quality Assurance and Testing",
     "Project Quality Management and Control"),
]


def main():
    apply_changes = "--apply" in sys.argv
    db = SessionLocal()
    print("mode: %s\n" % ("APPLY" if apply_changes else "DRY RUN"))

    for lesson_id, old_name, new_name in RENAMES:
        current = db.execute(text(
            "select name from public.lessons where lesson_id = :i"),
            {"i": lesson_id}).scalar()

        if current == new_name:
            print("lesson %s already renamed" % lesson_id)
            continue
        if current != old_name:
            print("lesson %s is named %r, expected %r -- skipping"
                  % (lesson_id, current, old_name))
            continue

        quizzes = db.execute(text("""
            select exam_id, title from public.exams
             where lesson_id = :i and title like :pattern"""),
            {"i": lesson_id, "pattern": "%s%%" % old_name}).fetchall()

        print("lesson %s" % lesson_id)
        print("    %r" % old_name)
        print(" -> %r" % new_name)
        for exam_id, title in quizzes:
            print("    exam %s  %r -> %r"
                  % (exam_id, title, title.replace(old_name, new_name)))

        if apply_changes:
            db.execute(text(
                "update public.lessons set name = :n where lesson_id = :i"),
                {"n": new_name, "i": lesson_id})
            for exam_id, title in quizzes:
                db.execute(text("""
                    update public.exams
                       set title = :t, updated_at = now()
                     where exam_id = :e"""),
                    {"t": title.replace(old_name, new_name), "e": exam_id})

            # The lesson's own name is also the first section of its component
            # structure, which is what the lesson page renders as its title.
            # Leaving that behind would show the old name on the page itself.
            structure = db.execute(text(
                "select lesson_component_structure from public.lessons "
                "where lesson_id = :i"), {"i": lesson_id}).scalar()
            if structure and structure[0].get("sectionName") == old_name:
                structure[0]["sectionName"] = new_name
                import json
                db.execute(text("""
                    update public.lessons
                       set lesson_component_structure = cast(:s as jsonb)
                     where lesson_id = :i"""),
                    {"s": json.dumps(structure), "i": lesson_id})
                print("    title section updated")

    if apply_changes:
        db.commit()
        print("\nrenamed")
    else:
        print("\ndry run -- re-run with --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
