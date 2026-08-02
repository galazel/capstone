from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.ai import tasks
from app.schemas.certification.auditor_schema import AuditorResult
from app.utils.helpers import get_llm

SYSTEM_PROMPT = (
    "You are an AI auditor. Determine if the uploaded document samples are "
    "relevant to the target certification. Return only the structured "
    "AuditorResult: is_related (boolean) and reason (a short string "
    "explaining your decision)."
)


@lru_cache(maxsize=None)
def get_auditor_agent(model: str | None = None):
    """Built on first use, not at import.

    Constructing this at module scope instantiated an API client (and so
    required a key) merely to *import* any module in the certification graph,
    which is what made graph nodes untestable.

    The cheapest job in the service -- is this document about this
    certification, yes or no -- so `app.ai.tasks` points it at the smallest
    model in the table and gives it a 512-token budget.
    """
    return create_agent(
        model=get_llm(tasks.DOCUMENT_AUDIT, model),
        tools=[],
        response_format=ToolStrategy(AuditorResult),
        system_prompt=SYSTEM_PROMPT,
    )
