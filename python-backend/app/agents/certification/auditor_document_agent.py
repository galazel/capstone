from langchain.agents import create_agent
from app.utils.helpers import llm

auditor_agent = create_agent(
    model=llm,
    tools=[],
    system_prompt="You are an AI auditor. Determine if the uploaded document samples are relevant to the target certification. Return valid JSON with two keys: 'is_related' (boolean) and 'reason' (a short string explaining your decision)."
)