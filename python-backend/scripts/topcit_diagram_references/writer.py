"""Shared write path for the hand-authored diagram batches.

The stem and the reference have to be written together: a reference built for
one stem is the wrong answer to another, which is exactly how the first 37
AI-generated references were wasted.
"""

import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal

#: Separates the scenario from the numbered tasks in the stored stem. Also what
#: the resume query looks for to tell a rewritten question from an old one.
MARKER = "\n\nTasks\n"

PROCESS_LEGEND = [
    "stadium = start / end",
    "rounded box = action or process step",
    "rhombus = decision, every branch carries its guard",
    "thick bar = fork / join (concurrent paths)",
]


def write_batch(batch, label):
    db = SessionLocal()
    written = 0
    for config_id, question, instructions, build in batch:
        xml = build()
        row = db.execute(text(
            "select question_id from public.diagram_question_configs "
            "where diagram_question_config_id = :c"), {"c": config_id}).fetchone()
        if row is None:
            print("  cfg %-4s NOT FOUND" % config_id)
            continue
        db.execute(text("update public.questions set question_text = :q where question_id = :id"),
                   {"q": question.strip() + MARKER + instructions.strip(), "id": row[0]})
        db.execute(text("""
            update public.diagram_question_configs
               set instructions = :i, reference_diagram_xml = :x
             where diagram_question_config_id = :c"""),
            {"i": instructions.strip(), "x": xml, "c": config_id})
        db.commit()
        written += 1
        print("  cfg %-4s stem %5d chars   reference %5d chars, %2d cells"
              % (config_id, len(question) + len(instructions), len(xml), xml.count("<mxCell")))
    print()
    print("%s written: %d questions" % (label, written))
