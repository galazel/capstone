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
                    - Every Major Category is a separate entry in the
                      top-level "majorCategories" array. Never place a
                      Major Category inside another Major Category's
                      "middleCategories" array. An entry inside
                      "middleCategories" ALWAYS has a "lessons" array and
                      NEVER has a "middleCategories" array of its own.
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


                    Size:

                    A curriculum is the whole certification, not a sample of
                    it. Produce:

                    - 3 to 6 Major Categories
                    - 2 to 4 Middle Categories inside EVERY Major Category
                    - 3 to 5 Lessons inside EVERY Middle Category

                    Never stop after one Major Category, and never leave a
                    Middle Category with a single lesson. A real certification
                    syllabus has dozens of lessons; match its breadth.


                    Rules:

                    - Follow beginner to advanced progression.
                    - Avoid duplicate topics.
                    - Cover every exam objective, not just the first few.
                    - Do not generate lesson content.
                    - Do not create quizzes.
                    - Do not create assessments.
                    - Do not explain concepts.
                    - Output only JSON.
                    - Put every field inside the tool arguments object.
                      Nothing may follow the closing brace.



                    """


@lru_cache(maxsize=None)
def get_curriculum_agent(model: str | None = None):
    return create_agent(
        model=get_llm("generation", model),
        tools=curriculum_tools,
        response_format=ToolStrategy(CertificationCurriculum),
        system_prompt=SYSTEM_PROMPT,
    )