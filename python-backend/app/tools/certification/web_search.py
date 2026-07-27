"""Shared, deduplicated web-search helpers for the certification/lesson tool
files. Uses httpx (sync client) instead of `requests` for a more modern,
timeout-safe HTTP client; kept synchronous because the agents that bind these
tools are still invoked via `.invoke()` (async-only tools cannot be called
synchronously in this LangChain version)."""

import httpx

from app.utils.helpers import get_serper_key, get_youtube_key

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def serper_search(query: str, num: int = 5) -> list[dict]:
    """Runs a Serper.dev web search and returns the raw `organic` results."""
    if not get_serper_key():
        raise RuntimeError("SERPER_API_KEY not configured.")

    with httpx.Client(timeout=_TIMEOUT) as client:
        response = client.post(
            "https://google.serper.dev/search",
            json={"q": query, "num": num},
            headers={"X-API-KEY": get_serper_key(), "Content-Type": "application/json"},
        )
    response.raise_for_status()
    return response.json().get("organic", [])


def serper_image_search(query: str, num: int = 1) -> list[dict]:
    """Runs a Serper.dev image search and returns the raw `images` results."""
    if not get_serper_key():
        raise RuntimeError("SERPER_API_KEY not configured.")

    with httpx.Client(timeout=_TIMEOUT) as client:
        response = client.post(
            "https://google.serper.dev/images",
            json={"q": query, "num": num},
            headers={"X-API-KEY": get_serper_key(), "Content-Type": "application/json"},
        )
    response.raise_for_status()
    return response.json().get("images", [])


def youtube_search(query: str, max_results: int = 1) -> list[dict]:
    """Runs a YouTube Data API v3 search and returns the raw `items` results."""
    if not get_youtube_key():
        raise RuntimeError("YOUTUBE_API_KEY not configured.")

    with httpx.Client(timeout=_TIMEOUT) as client:
        response = client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": max_results,
                "key": get_youtube_key(),
            },
        )
    response.raise_for_status()
    return response.json().get("items", [])


def format_organic_results(results: list[dict]) -> str:
    """Formats Serper `organic` results into the Title/Snippet/Source block every search tool returns."""
    if not results:
        return ""
    blocks = [
        f"Title: {item.get('title', '')}\nSnippet: {item.get('snippet', '')}\nSource: {item.get('link', '')}"
        for item in results
    ]
    return "\n\n---\n\n".join(blocks)
