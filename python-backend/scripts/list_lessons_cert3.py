import json
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.db.session import SessionLocal
from app.repositories import java_backend as repo

if __name__ == '__main__':
    with SessionLocal() as s:
        rows = repo.list_certification_lessons(s, 3)
        print(json.dumps(rows, indent=2, ensure_ascii=False))
