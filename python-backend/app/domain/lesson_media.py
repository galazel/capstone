"""Filling in the image and video URLs a generated lesson asks for.

The lesson agent used to hold `search_educational_image` and
`search_youtube_videos` and was expected to call them, then paste the returned
URL into the block it was writing. It could not do it. Every attempt produced
blocks that were correct right up to the media key, then inlined the call as
the value::

    {"type": "image", "data": {"imageKey": "<function=search_educational_image{...

which the provider rejects outright. The pattern is the same one that took the
eighteen lesson-builder tools out of that agent: a tool whose *result* has to
appear inside the structured answer invites the model to write the call where
the result belongs.

So the model no longer searches. It states what the picture should be --
`imageQuery` / `videoQuery`, which it can write as ordinary JSON -- and the
search happens here afterwards, where it is deterministic, cached per lesson,
and cannot fail the generation.
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

from app.tools.certification.web_search import serper_image_search, youtube_search

logger = logging.getLogger(__name__)

#: `data` key holding the request -> (resolved URL key, source page URL key,
#: source name key). The source keys let the renderer credit where a picture
#: came from instead of showing an unattributed image.
MEDIA_REQUESTS = {
    "imageQuery": ("imageKey", "imageSourceUrl", "imageSourceName"),
    "videoQuery": ("videoKey", "videoSourceUrl", "videoSourceName"),
}

_EMPTY_RESULT = {"url": "", "sourceUrl": "", "sourceName": ""}

#: How many image candidates to fetch per query before picking one. Serper's
#: #1 result is frequently a generic stock/social repost that merely ranks
#: well, not the best match for the query -- asking for a few and scoring them
#: catches that without a second network round-trip per block.
_IMAGE_CANDIDATES = 5

_DIAGRAM_HINTS = {"diagram", "chart", "graph", "architecture", "illustration", "infographic", "schematic"}

#: Domains that routinely surface in image search but are reposts/social
#: shares rather than the original educational source -- rarely a good match
#: for a lesson's technical query.
_LOW_SIGNAL_DOMAINS = {
    "pinterest.com", "pinimg.com", "tumblr.com", "imgur.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com", "reddit.com",
}

_STOPWORDS = {"the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "with", "vs"}


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in _STOPWORDS}


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.removeprefix("www.")
    except Exception:
        return ""


def _search_terms(query: str) -> str:
    """Appends a diagram hint only when the query doesn't already carry one.

    The old code always appended " diagram architecture chart", which for a
    query the model already wrote as e.g. "requirement management diagram"
    produced "requirement management diagram diagram architecture chart" --
    a duplicated, unfocused query that pulled in generic architecture-diagram
    results with nothing to do with the actual lesson topic.
    """
    if _DIAGRAM_HINTS & _keywords(query):
        return query
    return f"{query} diagram"


def _best_image(query: str, candidates: list[dict]) -> dict | None:
    """Picks the candidate whose title best overlaps the query, skipping
    known low-signal sources. Falls back to the top raw result if every
    candidate gets filtered out or none score -- an unranked image still beats
    no image."""
    query_words = _keywords(query)
    ranked = sorted(
        (image for image in candidates if _domain(image.get("link", "")) not in _LOW_SIGNAL_DOMAINS),
        key=lambda image: len(query_words & _keywords(image.get("title", ""))),
        reverse=True,
    )
    if ranked:
        return ranked[0]
    return candidates[0] if candidates else None


def _search_image(query: str) -> dict:
    candidates = serper_image_search(_search_terms(query), num=_IMAGE_CANDIDATES)
    best = _best_image(query, candidates)
    if not best:
        return dict(_EMPTY_RESULT)

    source_url = best.get("link", "")
    return {
        "url": best.get("imageUrl", ""),
        "sourceUrl": source_url,
        "sourceName": best.get("source") or _domain(source_url),
    }


def _search_video(query: str) -> dict:
    items = youtube_search(query, max_results=1)
    if not items:
        return dict(_EMPTY_RESULT)

    video_id = items[0]["id"]["videoId"]
    url = f"https://www.youtube.com/watch?v={video_id}"
    channel = items[0].get("snippet", {}).get("channelTitle", "")
    return {"url": url, "sourceUrl": url, "sourceName": channel or "YouTube"}


_SEARCHERS = {"imageQuery": _search_image, "videoQuery": _search_video}


#: How many media lookups run at once for one lesson.
#:
#: A lesson asks for five to seven pictures and each search is a round trip of
#: a second or two, so resolving them one at a time spent ten to fifteen
#: seconds per lesson waiting -- minutes across a curriculum, for work that has
#: no order to it. Kept modest because the search provider rate-limits, and
#: because a burst that trips the limit costs illustrations rather than saving
#: time.
_MEDIA_WORKERS = 5


def _resolve_one(request_key: str, query: str) -> dict:
    """One media lookup, never raising.

    A failed search is a lesson without a picture, which an admin can fill in.
    A raised exception would be a lesson lost after it was already paid for.
    """
    try:
        return _SEARCHERS[request_key](query)
    except Exception as error:  # network, quota, malformed response
        logger.warning("Media search for %r failed: %s", query, error)
        return dict(_EMPTY_RESULT)


def _collect_requests(sections: list[dict]) -> set[tuple[str, str]]:
    """Every distinct (kind, query) the lesson asks for, before any run.

    Deduplicating up front is what makes the searches parallelisable: the
    serial version deduplicated as it walked, which meant it could not know
    what to dispatch until it had already dispatched most of it.
    """
    wanted: set[tuple[str, str]] = set()
    for block in sections:
        if not isinstance(block, dict) or not isinstance(block.get("data"), dict):
            continue
        for request_key in MEDIA_REQUESTS:
            query = block["data"].get(request_key)
            if isinstance(query, str) and query.strip():
                wanted.add((request_key, query))
    return wanted


def resolve_media(sections: list[dict]) -> list[dict]:
    """Replaces each block's media *request* with a real URL, plus who it
    came from.

    Never raises and never invents a URL: a failed or empty search leaves the
    key blank, which renders as a block without media and is exactly what an
    admin can fill in later. Losing an illustration must not lose the lesson.

    Searches run concurrently and are deduplicated first, so a diagram
    requested by three blocks costs one search rather than three, and a lesson
    wanting six pictures waits for the slowest rather than the sum.
    """
    wanted = _collect_requests(sections)
    resolved: dict[tuple[str, str], dict] = {}

    if wanted:
        with ThreadPoolExecutor(max_workers=min(_MEDIA_WORKERS, len(wanted))) as pool:
            futures = {
                pool.submit(_resolve_one, request_key, query): (request_key, query)
                for request_key, query in wanted
            }
            for future in as_completed(futures):
                # _resolve_one swallows its own failures, so this cannot raise
                # -- but a pool that died would, and that must not lose the
                # lesson either.
                try:
                    resolved[futures[future]] = future.result()
                except Exception as error:
                    logger.warning("Media lookup pool failed for %r: %s",
                                   futures[future], error)
                    resolved[futures[future]] = dict(_EMPTY_RESULT)

    out = []

    for block in sections:
        if not isinstance(block, dict) or not isinstance(block.get("data"), dict):
            out.append(block)
            continue

        data = dict(block["data"])
        for request_key, (url_key, source_url_key, source_name_key) in MEDIA_REQUESTS.items():
            query = data.pop(request_key, None)
            if not isinstance(query, str) or not query.strip():
                continue

            result = resolved.get((request_key, query)) or dict(_EMPTY_RESULT)
            data[url_key] = result["url"] or data.get(url_key, "")
            if result["url"]:
                data[source_url_key] = result["sourceUrl"]
                data[source_name_key] = result["sourceName"]
            data.setdefault("file", None)

        out.append({**block, "data": data})

    return out
