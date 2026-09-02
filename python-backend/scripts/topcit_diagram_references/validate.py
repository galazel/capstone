"""Structural check on every rewritten reference diagram.

A reference that does not parse opens as an empty canvas, which is worse than
no reference at all: the learner is shown a blank page as the correct answer.
Every batch is checked before it counts as done.
"""

import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db.session import SessionLocal
from writer import MARKER


def main():
    db = SessionLocal()
    rows = db.execute(text("""
        select d.diagram_question_config_id, d.diagram_type, d.reference_diagram_xml
          from public.diagram_question_configs d
          join public.questions q on q.question_id = d.question_id
          join public.lessons l on l.lesson_id = q.lesson_id
          join public.middle_categories mc on mc.middle_category_id = l.middle_category_id
          join public.major_categories m on m.major_category_id = mc.major_category_id
         where m.certification_id = 13 and position(:mk in q.question_text) > 0
         order by d.diagram_question_config_id"""), {"mk": MARKER}).fetchall()

    problems = 0
    for cid, dtype, xml in rows:
        try:
            root = ET.fromstring(xml or "")
        except Exception as error:
            print("cfg %-4s %-18s XML PARSE FAIL: %s" % (cid, dtype, error))
            problems += 1
            continue
        cells = list(root.iter("mxCell"))
        ids = {c.get("id") for c in cells}
        dangling = [c.get("id") for c in cells
                    if (c.get("source") and c.get("source") not in ids)
                    or (c.get("target") and c.get("target") not in ids)]
        vertices = sum(1 for c in cells if c.get("vertex") and (c.get("value") or "").strip())
        edges = sum(1 for c in cells if c.get("edge"))
        if dangling:
            print("cfg %-4s %-18s DANGLING EDGE ENDS: %s" % (cid, dtype, dangling))
            problems += 1
        elif vertices < 6 or edges < 4:
            print("cfg %-4s %-18s THIN: %d labelled vertices, %d edges"
                  % (cid, dtype, vertices, edges))
            problems += 1

    print()
    print("checked %d references, %d problems" % (len(rows), problems))
    return problems


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
