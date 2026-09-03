"""Finding lesson images on Wikimedia, and proving they load before using them.

Serper is out of credits, but the deeper problem is that Serper was never the
right source for this. Its top hit is whatever ranks, on whatever host, under
whatever licence -- which is how every image in the hand-written lessons ended
up on a domain that 403s hotlinks, with no licence anyone had checked.

Wikimedia fixes all three at once: it permits hotlinking, its URLs are stable,
and everything on it carries an open licence. The cost is that a bare Commons
search is easily fooled by ambiguous acronyms -- "STRIDE" returns a British MP,
"SIEM" returns butterflies photographed in Siem Reap. So the lookup is anchored
two ways:

  1. Resolve the topic to an English Wikipedia article, and prefer images that
     article actually uses. An article is a human-curated statement that these
     pictures illustrate this subject.
  2. Fall back to a Commons file search, but only accept a file whose *name*
     overlaps the query. An unscored Commons hit is how you get the butterfly.

Either way the URL is then fetched with browser headers and kept only if real
image bytes come back.
"""

import re
from urllib.parse import urlparse, urlunparse

import httpx

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

#: Wikimedia asks automated clients to identify themselves.
USER_AGENT = "REBYU-lesson-media/1.0 (educational courseware; contact via repository)"

BROWSER_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "Referer": "http://localhost:3000/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

MIN_BYTES = 3000
THUMB_WIDTH = 1200

STOPWORDS = {
    "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "with", "vs",
    "how", "what", "why", "it", "its", "is", "are", "that", "this", "by", "from",
    "diagram", "chart", "model", "overview", "introduction", "example", "works",
}

#: Wikimedia file names that are chrome rather than content -- icons, logos,
#: edit-pencils and the like turn up in almost every article's image list.
JUNK_PATTERNS = re.compile(
    r"(icon|logo|wiki|commons|edit|padlock|ambox|question book|crystal|nuvola|"
    r"symbol|flag of|stub|disambig|portal|emblem|barnstar|folder|magnify|"
    r"lampflowchart|text document|merge|split arrows|red pencil|office building)",
    re.IGNORECASE,
)

#: Diagrams on Commons are drawn as SVG or exported to PNG; photographs are
#: JPEG. Excluding JPEG is the single most effective relevance filter there
#: is here, because the wrong-but-word-matching hit is almost always a photo:
#: "STRIDE" finds Elizabeth Stride's grave, "incident response" a fire truck.
#: A lesson wants the drawing, so only drawings are eligible.
ALLOWED_EXTENSIONS = (".svg", ".png")

#: Commons search is unanchored, so one shared word is not enough to trust it.
MIN_COMMONS_OVERLAP = 2


def keywords(text):
    return {word for word in re.findall(r"[a-z0-9]+", (text or "").lower())
            if len(word) > 2 and word not in STOPWORDS}


def strip_tracking(url):
    """Drops the utm_* query the API appends; the bare path is the stable URL."""
    parts = urlparse(url)
    return urlunparse(parts._replace(query="", fragment=""))


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


def _api(client, endpoint, params):
    params = dict(params, action="query", format="json", formatversion="2")
    try:
        response = client.get(endpoint, params=params, headers={"User-Agent": USER_AGENT})
        if response.status_code != 200:
            return {}
        return response.json()
    except Exception:
        return {}


def _usable(page):
    title = page.get("title", "")
    if not title.lower().endswith(ALLOWED_EXTENSIONS):
        return None
    if JUNK_PATTERNS.search(re.sub(r"[-_]", " ", title)):
        return None
    info = (page.get("imageinfo") or [{}])[0]
    url = info.get("thumburl") or info.get("url")
    if not url:
        return None
    return {"title": title, "url": strip_tracking(url),
            "descriptionUrl": info.get("descriptionurl", "")}


def _article_images(client, query):
    """Images used by the best-matching English Wikipedia article."""
    search = _api(client, WIKIPEDIA_API,
                  {"list": "search", "srsearch": query, "srlimit": 1})
    hits = search.get("query", {}).get("search", [])
    if not hits:
        return "", []
    title = hits[0]["title"]

    data = _api(client, WIKIPEDIA_API, {
        "titles": title, "generator": "images", "gimlimit": 40,
        "prop": "imageinfo", "iiprop": "url|size", "iiurlwidth": THUMB_WIDTH,
    })
    pages = data.get("query", {}).get("pages", []) or []
    return title, [item for item in (_usable(page) for page in pages) if item]


def _commons_images(client, query):
    """Commons file search, used only when the article route finds nothing."""
    data = _api(client, COMMONS_API, {
        "generator": "search", "gsrsearch": "filetype:bitmap|drawing " + query,
        "gsrnamespace": 6, "gsrlimit": 20,
        "prop": "imageinfo", "iiprop": "url|size", "iiurlwidth": THUMB_WIDTH,
    })
    pages = data.get("query", {}).get("pages", []) or []
    return [item for item in (_usable(page) for page in pages) if item]


def _rank(candidates, query_words, minimum):
    """Sorts by how much the file name overlaps the query.

    `require_overlap` is what keeps the butterfly out. A file whose name
    shares no word with the query is the wrong picture even when it came
    from the right article -- that is how a generic flowchart illustrating
    "STRIDE model" gets picked for a lesson on threat modelling.
    """
    scored = []
    for candidate in candidates:
        overlap = len(query_words & keywords(candidate["title"]))
        if overlap < min(minimum, len(query_words)):
            continue
        scored.append((overlap, candidate))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [candidate for _score, candidate in scored]


def find_image(client, queries):
    """First image across the given queries that is relevant AND actually loads."""
    tried = set()
    for query in queries:
        query_words = keywords(query)
        if not query_words:
            continue

        article, article_images = _article_images(client, query)
        ordered = _rank(article_images, query_words, minimum=1)
        ordered += _rank(_commons_images(client, query), query_words,
                         minimum=MIN_COMMONS_OVERLAP)

        for candidate in ordered:
            if candidate["url"] in tried:
                continue
            tried.add(candidate["url"])
            if not loads_as_image(client, candidate["url"]):
                continue
            return {
                "url": candidate["url"],
                "sourceUrl": candidate.get("descriptionUrl")
                             or ("https://en.wikipedia.org/wiki/" + article.replace(" ", "_")
                                 if article else "https://commons.wikimedia.org/"),
                "sourceName": "Wikimedia Commons",
                "matched": candidate["title"],
                "article": article,
            }
    return None


def client():
    return httpx.Client(timeout=25.0, follow_redirects=True,
                        headers=BROWSER_HEADERS, verify=False)
