from functools import lru_cache

from app.tools.certification.curriculum_tools import curriculum_tools
from langchain.agents import create_agent
from app.utils.helpers import get_llm
from langchain.agents.structured_output import ToolStrategy
from app.schemas.certification.curriculum_schema import CertificationCurriculum

SYSTEM_PROMPT = """
                    You are REBYU Curriculum Planning Agent.

                    Create a professional certification curriculum blueprint.

                    Hierarchy:

                    Certification
                     └── Major Categories
                          └── Middle Categories
                               └── Lessons


                    IMPORTANT:

                    - Major Categories contain only Middle Categories.
                    - Middle Categories contain only Lessons.
                    - Never create separate arrays for categories and lessons.
                    - Return only curriculum JSON data.
                    - Do not return JSON schema.


                    Major Category format:

                    {
                     "name": "",
                     "description": "",
                     "middleCategories": []
                    }


                    Middle Category format:

                    {
                     "name": "",
                     "description": "",
                     "lessons": []
                    }


                    Lesson format:

                    {
                     "name": "",
                     "learning_objective": "",
                     "lessonGenerationInstructions": {}
                    }


                    lessonGenerationInstructions must contain every field
                    below, using exactly the type shown. Fields marked
                    [array of strings] are ALWAYS a JSON array -- write
                    ["value"], never "value", even when there is only one
                    entry:

                    - introduction (object)
                      - prerequisites            [array of strings]
                      - motivation               (string)
                      - certification_relevance  (string)
                      - industry_importance      (string)

                    - concepts                   [array of strings]
                    - learning_progression       [array of strings]
                    - technical_topics           [array of strings]
                    - visual_recommendations     [array of strings]
                    - real_world_applications    [array of strings]
                    - comparisons                [array of strings]
                    - common_mistakes            [array of strings]
                    - best_practices             [array of strings]
                    - relationships              [array of strings]
                    - certification_focus        [array of strings]
                    - expected_learner_outcome   (string)


                    Rules:

                    - Follow beginner to advanced progression.
                    - Avoid duplicate topics.
                    - Cover exam objectives.
                    - Do not generate lesson content.
                    - Do not create quizzes.
                    - Do not create assessments.
                    - Do not explain concepts.
                    - Output only JSON.
                    - Put every field inside the tool arguments object.
                      Nothing may follow the closing brace.



                    """


@lru_cache(maxsize=1)
def get_curriculum_agent():
    return create_agent(
        model=get_llm("generation"),
        tools=curriculum_tools,
        response_format=ToolStrategy(CertificationCurriculum),
        system_prompt=SYSTEM_PROMPT,
    )