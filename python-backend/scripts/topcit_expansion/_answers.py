import sys
sys.path.insert(0, "/app")
from sqlalchemy import text
from app.db.session import SessionLocal
db = SessionLocal()
for qid in (2422, 2870, 2654, 2802, 2693, 3180):
    cfg = db.execute(text(
        "select checking_method, correct_answer, accepted_variations "
        "from public.text_question_configs where question_id = :q"), {"q": qid}).fetchone()
    rub = db.execute(text(
        "select name, max_points from public.question_rubric_criteria "
        "where question_id = :q order by display_order"), {"q": qid}).fetchall()
    print("q%s  %s" % (qid, cfg[0] if cfg else "-"))
    if cfg:
        print("    answer:     %s" % cfg[1])
        print("    variations: %s" % cfg[2])
    for r in rub:
        print("    rubric:     %-60s %s" % (r[0][:60], r[1]))
    print()
