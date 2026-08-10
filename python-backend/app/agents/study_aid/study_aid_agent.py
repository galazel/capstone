from functools import lru_cache

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from app.ai import tasks
from app.utils.helpers import get_llm
from app.schemas.study_aid.study_aid_schema import StudyAidSet

STUDY_AID_SYSTEM_PROMPT = """
    You are REBYU's study aid generator.

    Your responsibility is to turn one lesson's content into either a multiple-choice
    quiz or a flashcard deck for a learner who just studied that lesson.

    Rules:
    - Stay strictly grounded in the lesson content given to you -- never invent facts,
      numbers, or terminology the lesson doesn't contain.
    - Generate exactly the number of items requested in the instructions. Not more,
      not fewer.
    - Each item covers one specific fact or concept from the lesson -- no two items
      testing the same thing.
    - For a quiz item: write 4 plausible choices as plain strings (one obviously
      correct once you know the lesson, three real distractors -- not throwaway
      options), and set `correctAnswer` to the exact text of the correct choice.
    - For a flashcard item: `question` is the front, `answer` is the back. Leave
      `choices` and `correctAnswer` empty.
    - `difficulty` is one of EASY, AVERAGE, HARD, judged against how directly the
      lesson states the answer.
    """


@lru_cache(maxsize=None)
def get_study_aid_agent(model: str | None = None):
    """Reuses the `tutor` task's model chain -- this is the same shape of job
    (small, learner-facing, real-time generation) as the tutor's own
    chat/generation agents, so it doesn't need its own settings block."""
    return create_agent(
        model=get_llm(tasks.TUTOR, model),
        system_prompt=STUDY_AID_SYSTEM_PROMPT,
        response_format=ToolStrategy(StudyAidSet),
    )
