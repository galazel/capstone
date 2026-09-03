"""Checks every lesson image URL in certification 13 actually loads.

Hotlinked third-party images rot, and some hosts serve a 200 to a bare fetch
while blocking a browser request that carries a Referer. This fetches each URL
the way the browser does and reports what genuinely renders.
"""

import json
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

import httpx
from sqlalchemy import text

from app.db.session import SessionLocal

SQL = """
SELECT l.lesson_id, l.name, l.lesson_component_structure
FROM lessons l
JOIN middle_categories mc ON mc.middle_category_id = l.middle_category_id
JOIN major_categories mj ON mj.major_category_id = mc.major_category_id
WHERE mj.certification_id = 13
ORDER BY l.lesson_id
"""

IMG_TYPES = {"image", "image-left-text", "image-right-text",
             "image-feature-grid", "intro-image-card", "media-text-block"}

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Referer": "http://localhost:3000/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


def image_urls(structure):
    for section in structure or []:
        for block in section.get("content", []):
            if block.get("type") not in IMG_TYPES:
                continue
            data = block.get("data") or {}
            if data.get("imageKey"):
                yield data["imageKey"]
            for item in data.get("images", []) or []:
                if item.get("imageKey"):
                    yield item["imageKey"]


def check(client, url):
    # Locally drawn figures are served by the frontend container, not the web.
    if url.startswith("/"):
        url = "http://frontend" + url
    try:
        response = client.get(url)
    except Exception as error:
        return False, type(error).__name__
    content_type = response.headers.get("content-type", "").split(";")[0]
    good = (response.status_code == 200
            and content_type.startswith("image/")
            and len(response.content) > 1000)
    return good, "%s %s %db" % (response.status_code, content_type, len(response.content))


def main():
    db = SessionLocal()
    rows = db.execute(text(SQL)).fetchall()
    db.close()

    urls = {}
    for lesson_id, _name, structure in rows:
        if isinstance(structure, str):
            structure = json.loads(structure)
        for url in image_urls(structure):
            urls.setdefault(url, set()).add(lesson_id)

    print("distinct image urls: %d" % len(urls))

    tally = {"mine": [0, 0], "system": [0, 0]}
    broken = []
    # Dead hosts hang rather than refuse, and 100+ of them at 20s each
    # outlasts the docker exec connection. A slow image is a broken
    # image for a reader anyway, so a short timeout is the right check.
    with httpx.Client(timeout=6.0, follow_redirects=True,
                      headers=HEADERS, verify=False) as client:
        for url, lessons in urls.items():
            bucket = "mine" if min(lessons) >= 405 else "system"
            good, status = check(client, url)
            tally[bucket][0 if good else 1] += 1
            if not good:
                broken.append((bucket, sorted(lessons), status, url))

    for bucket in ("mine", "system"):
        print("%-7s ok %3d   BROKEN %3d" % (bucket.upper(), *tally[bucket]))

    print("\n-- broken --")
    for bucket, lessons, status, url in sorted(broken):
        print("%-7s %-20s %-26s %s" % (bucket, lessons, status, url[:90]))


if __name__ == "__main__":
    main()
