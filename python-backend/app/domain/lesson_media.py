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
from typing import Any

from app.tools.certification.web_search import serper_image_search, youtube_search

logger = logging.getLogger(__name__)

#: `data` key holding the request -> the key holding the resolved URL.
MEDIA_REQUESTS = {"imageQuery": "imageKey", "videoQuery": "videoKey"}


def _search_image(query: str) -> str:
    images = serper_image_search(query + " diagram architecture chart", num=1)
    return images[0].get("imageUrl", "") if images else ""


def _search_video(query: str) -> str:
    items = youtube_search(query, max_results=1)
    if not items:
        return ""
    return f"https://www.youtube.com/watch?v={items[0]['id']['videoId']}"


_SEARCHERS = {"imageQuery": _search_image, "videoQuery": _search_video}


def resolve_media(sections: list[dict]) -> list[dict]:
    """Replaces each block's media *request* with a real URL.

    Never raises and never invents a URL: a failed or empty search leaves the
    key blank, which renders as a block without media and is exactly what an
    admin can fill in later. Losing an illustration must not lose the lesson.

    Results are cached across the lesson, so a diagram requested by three
    blocks costs one search rather than three.
    """
    resolved: dict[tuple[str, str], str] = {}
    out = []

    for block in sections:
        if not isinstance(block, dict) or not isinstance(block.get("data"), dict):
            out.append(block)
            continue

        data = dict(block["data"])
        for request_key, url_key in MEDIA_REQUESTS.items():
            query = data.pop(request_key, None)
            if not isinstance(query, str) or not query.strip():
                continue

            cache_key = (request_key, query)
            if cache_key not in resolved:
                try:
                    resolved[cache_key] = _SEARCHERS[request_key](query)
                except Exception as error:  # network, quota, malformed response
                    logger.warning("Media search for %r failed: %s", query, error)
                    resolved[cache_key] = ""

            data[url_key] = resolved[cache_key] or data.get(url_key, "")
            data.setdefault("file", None)

        out.append({**block, "data": data})

    return out
