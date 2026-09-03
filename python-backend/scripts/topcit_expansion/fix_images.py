"""Replaces dead lesson images with ones that have been proven to load.

Every image URL in the hand-written TOPCIT lessons was constructed by pattern
rather than looked up, and every one of them 403s: the host blocks hotlinking.
The generated lessons have the same disease in milder form, because
`lesson_media` trusts Serper's top hit without ever fetching it.

So this does what that pipeline does not: it searches, then it downloads each
candidate the way a browser would, and only keeps a URL that comes back as
real image bytes. A picture that cannot be fetched is not a picture.

Usage:
    docker compose exec -T python-api python /app/scripts/topcit_expansion/fix_images.py
    docker compose exec -T python-api python /app/scripts/topcit_expansion/fix_images.py --apply
    docker compose exec -T python-api python /app/scripts/topcit_expansion/fix_images.py --apply --all
"""

import json
import sys
from urllib.parse import urlparse

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

import httpx
from sqlalchemy import text

from app.db.session import SessionLocal
from app.tools.certification.web_search import serper_image_search

MINE_FROM = 405

IMG_TYPES = {"image", "image-left-text", "image-right-text",
             "image-feature-grid", "intro-image-card", "media-text-block"}

BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Referer": "http://localhost:3000/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

#: Hosts that either block hotlinking outright or serve reposts rather than the
#: original diagram. Each one was observed 403-ing or rate limiting during the
#: audit that prompted this script.
BLOCKED_DOMAINS = {
    "media.geeksforgeeks.org", "geeksforgeeks.org",
    "researchgate.net", "mdpi.com", "lh7-rt.googleusercontent.com",
    "pinterest.com", "pinimg.com", "tumblr.com", "imgur.com",
    "facebook.com", "fbcdn.net", "instagram.com", "twitter.com",
    "x.com", "reddit.com", "redd.it", "slideshare.net", "scribd.com",
    "herbertograca.com", "creately.com", "quora.com", "chegg.com",
    "coursehero.com", "istockphoto.com", "shutterstock.com",
    "gettyimages.com", "alamy.com", "dreamstime.com",
}

CANDIDATES_PER_QUERY = 20
MIN_BYTES = 3000


def domain(url):
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def blocked(url):
    host = domain(url)
    return any(host == known or host.endswith("." + known) for known in BLOCKED_DOMAINS)


def loads_as_image(client, url):
    """True only when the URL returns real image bytes to a browser-shaped request."""
    try:
        response = client.get(url)
    except Exception:
        return False
    content_type = response.headers.get("content-type", "").split(";")[0].strip()
    return (response.status_code == 200
            and content_type.startswith("image/")
            and len(response.content) > MIN_BYTES)


def find_working_image(client, queries):
    """First candidate across all queries that survives an actual fetch."""
    seen = set()
    for query in queries:
        try:
            candidates = serper_image_search(query, num=CANDIDATES_PER_QUERY)
        except Exception as error:
            print("      ! serper failed: %s" % error)
            continue
        for candidate in candidates:
            url = candidate.get("imageUrl", "")
            if not url or url in seen:
                continue
            seen.add(url)
            if blocked(url) or blocked(candidate.get("link", "")):
                continue
            if not loads_as_image(client, url):
                continue
            source_url = candidate.get("link", "")
            return {
                "url": url,
                "sourceUrl": source_url,
                "sourceName": candidate.get("source") or domain(source_url) or "Web",
            }
    return None


def image_slots(structure):
    """Yields (section_name, slot) for every image reference in a lesson."""
    for section in structure or []:
        name = section.get("sectionName", "")
        for block in section.get("content", []):
            if block.get("type") not in IMG_TYPES:
                continue
            data = block.get("data") or {}
            if "imageKey" in data:
                yield name, data
            for item in data.get("images", []) or []:
                if "imageKey" in item:
                    yield name, item


def queries_for(lesson_name, section_name, slot):
    """Search terms, most specific first."""
    title = (slot.get("title") or "").strip()
    topic = " ".join(lesson_name.split(":")[0].split()[:6])
    wanted = []
    if title:
        wanted.append("%s diagram" % title)
    if section_name:
        wanted.append("%s diagram" % section_name)
        wanted.append("%s %s diagram" % (topic, section_name))
    wanted.append("%s diagram" % topic)

    seen, unique = set(), []
    for query in wanted:
        if query.lower() not in seen:
            seen.add(query.lower())
            unique.append(query)
    return unique


def main():
    apply = "--apply" in sys.argv
    every = "--all" in sys.argv

    db = SessionLocal()
    rows = db.execute(text("""
        SELECT l.lesson_id, l.name, l.lesson_component_structure
        FROM public.lessons l
        JOIN public.middle_categories mi ON mi.middle_category_id = l.middle_category_id
        JOIN public.major_categories mj ON mj.major_category_id = mi.major_category_id
        WHERE mj.certification_id = 13
        ORDER BY l.lesson_id
    """)).fetchall()

    print("mode: %s | scope: %s\n" % ("APPLY" if apply else "DRY RUN",
                                      "all lessons" if every else "lessons %d+" % MINE_FROM))

    replacements = {}
    fixed = failed = healthy = 0

    with httpx.Client(timeout=20.0, follow_redirects=True,
                      headers=BROWSER_HEADERS, verify=False) as client:
        for lesson_id, lesson_name, structure in rows:
            if not every and lesson_id < MINE_FROM:
                continue
            if isinstance(structure, str):
                structure = json.loads(structure)

            changed = False
            for section_name, slot in image_slots(structure):
                current = slot.get("imageKey") or ""
                if current and not blocked(current) and loads_as_image(client, current):
                    healthy += 1
                    continue

                print("  %d  %-40s  %s" % (lesson_id, lesson_name[:40], section_name[:38]))
                found = find_working_image(client, queries_for(lesson_name, section_name, slot))
                if not found:
                    print("      FAILED - no candidate loaded")
                    failed += 1
                    continue

                if current:
                    replacements[current] = found["url"]
                slot["imageKey"] = found["url"]
                slot["imageSourceUrl"] = found["sourceUrl"]
                slot["imageSourceName"] = found["sourceName"]
                changed = True
                fixed += 1
                print("      -> %s  (%s)" % (found["url"][:76], found["sourceName"]))

            if changed and apply:
                db.execute(
                    text("UPDATE public.lessons "
                         "SET lesson_component_structure = CAST(:body AS jsonb) "
                         "WHERE lesson_id = :lesson_id"),
                    {"body": json.dumps(structure), "lesson_id": lesson_id},
                )

    if apply:
        db.commit()
    db.close()

    with open("/app/scripts/topcit_expansion/_image_replacements.json", "w") as handle:
        json.dump(replacements, handle, indent=2)

    print("\nalready healthy %d | fixed %d | FAILED %d%s"
          % (healthy, fixed, failed, "" if apply else "   (dry run - nothing written)"))


if __name__ == "__main__":
    main()
