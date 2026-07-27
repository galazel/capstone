from langchain_core.tools import tool

from app.tools.certification.web_search import format_organic_results, serper_search


@tool("search_certification_coverage")
def search_certification_coverage(certification: str) -> str:
    """
    Searches the web for the official certification exam objectives,
    domains, skills measured, and syllabus.

    Returns summarized search snippets and source links.
    """
    try:
        results = serper_search(
            f"{certification} official exam objectives certification domains syllabus skills measured"
        )
    except RuntimeError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Search failed ({e})"

    return format_organic_results(results) or "No certification coverage found."


@tool("search_official_documentation")
def search_official_documentation(certification: str) -> str:
    """
    Searches only official vendor documentation for certification objectives.
    """
    query = (
        f'site:aws.amazon.com OR '
        f'site:microsoft.com OR '
        f'site:cisco.com OR '
        f'site:comptia.org OR '
        f'site:isc2.org '
        f'{certification} exam guide objectives'
    )
    try:
        results = serper_search(query)
    except RuntimeError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Search failed ({e})"

    return format_organic_results(results) or "No official documentation found."


curriculum_tools = [
    search_certification_coverage,
    search_official_documentation,
]
