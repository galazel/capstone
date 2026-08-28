from sqlalchemy import text
from app.db.session import SessionLocal
s = SessionLocal()
q = lambda sql, **kw: [dict(r._mapping) for r in s.execute(text(sql), kw)]
print("columns:", [r["column_name"] for r in q(
    "select column_name from information_schema.columns where table_name='programming_test_cases' order by ordinal_position")])
print()
rows = q("select * from programming_test_cases t "
         "join programming_question_configs c on c.programming_question_config_id = t.programming_question_config_id "
         "where c.question_id = 69")
print("test cases for question 69:", len(rows))
for r in rows:
    print("  ", {k: (str(v)[:50] if v is not None else None) for k, v in r.items()})
