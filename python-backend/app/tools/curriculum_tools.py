from langchain_core.tools import tool
import os
import requests

@tool("search_certification_coverage")
def search_certification_coverage(certification: str) -> str:
    """
    Searches the web for the official certification exam objectives,
    domains, skills measured, and syllabus.

    Returns summarized search snippets and source links.
    """

    api_key = os.getenv("SERPER_API_KEY")

    if not api_key:
        return "Error: SERPER_API_KEY not configured."

    url = "https://google.serper.dev/search"

    payload = {
        "q": f"{certification} official exam objectives certification domains syllabus skills measured",
        "num": 5
    }

    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code != 200:
        return f"Search failed ({response.status_code})"

    data = response.json()

    results = []

    for item in data.get("organic", []):
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        link = item.get("link", "")

        results.append(
            f"Title: {title}\n"
            f"Snippet: {snippet}\n"
            f"Source: {link}"
        )

    if not results:
        return "No certification coverage found."

    return "\n\n---\n\n".join(results)


@tool("search_official_documentation")
def search_official_documentation(certification: str) -> str:
    """
    Searches only official vendor documentation for certification objectives.
    """

    api_key = os.getenv("SERPER_API_KEY")

    if not api_key:
        return "Error: SERPER_API_KEY not configured."

    query = (
        f'site:aws.amazon.com OR '
        f'site:microsoft.com OR '
        f'site:cisco.com OR '
        f'site:comptia.org OR '
        f'site:isc2.org '
        f'{certification} exam guide objectives'
    )

    response = requests.post(
        "https://google.serper.dev/search",
        json={
            "q": query,
            "num": 5
        },
        headers={
            "X-API-KEY": api_key,
            "Content-Type": "application/json"
        }
    )

    if response.status_code != 200:
        return "Search failed."

    data = response.json()

    results = []

    for item in data.get("organic", []):
        results.append(
            f"{item['title']}\n"
            f"{item['snippet']}\n"
            f"{item['link']}"
        )

    return "\n\n".join(results)

curriculum_tools = [
    search_certification_coverage,
    search_official_documentation,
]