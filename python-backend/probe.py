import json, httpx, sys
sys.path.insert(0, "/app")
from app.core.database import get_db_connection

SQL = """
SELECT l.lesson_id, l.lesson_name, l.lesson_component_structure
FROM lessons l
JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
JOIN major_categories mj ON mj.major_category_id = mc.major_category_id
WHERE mj.certification_id = 13
ORDER BY l.lesson_id
"""

IMG_TYPES = {"image","image-left-text","image-right-text","image-feature-grid","intro-image-card"}

rows = []
with get_db_connection() as conn, conn.cursor() as cur:
    cur.execute(SQL)
    rows = cur.fetchall()

urls = {}   # url -> list of (lesson_id, mine?)
for lid, name, struct in rows:
    if isinstance(struct, str): struct = json.loads(struct)
    mine = lid >= 405
    for sec in struct or []:
        for b in sec.get("content", []):
            if b.get("type") not in IMG_TYPES: continue
            d = b.get("data") or {}
            for k in ("imageKey",):
                u = d.get(k)
                if u: urls.setdefault(u, []).append((lid, mine))
            for item in d.get("images", []) or []:
                u = item.get("imageKey")
                if u: urls.setdefault(u, []).append((lid, mine))

print("distinct image urls:", len(urls))

HDR = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
       "Referer":"http://localhost:3000/","Accept":"image/avif,image/webp,image/*,*/*;q=0.8"}

ok_mine=bad_mine=ok_sys=bad_sys=0
bad=[]
with httpx.Client(timeout=15.0, follow_redirects=True, headers=HDR, verify=False) as c:
    for u, refs in urls.items():
        mine = any(m for _, m in refs)
        try:
            r = c.get(u)
            ct = r.headers.get("content-type","")
            good = r.status_code == 200 and ct.startswith("image/") and len(r.content) > 1000
            status = "%s %s %db" % (r.status_code, ct.split(";")[0], len(r.content))
        except Exception as e:
            good = False; status = type(e).__name__
        if mine:
            if good: ok_mine+=1
            else: bad_mine+=1; bad.append((sorted({l for l,_ in refs}), status, u))
        else:
            if good: ok_sys+=1
            else: bad_sys+=1; bad.append((sorted({l for l,_ in refs}), status, u))

print("MINE   ok %d  BROKEN %d" % (ok_mine, bad_mine))
print("SYSTEM ok %d  BROKEN %d" % (ok_sys, bad_sys))
print("\n-- broken --")
for lids, st, u in sorted(bad):
    print("%-22s %-28s %s" % (lids, st, u[:95]))
