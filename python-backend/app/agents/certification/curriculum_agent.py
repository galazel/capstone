from tools.certification.curriculum_tools import curriculum_tools
from langchain.agents import create_agent
from app.utils.helpers import llm
from langchain.agents.structured_output import ToolStrategy
from schemas.certification.curriculum_schema import CertificationCurriculum

curriculum_agent = create_agent(
    model=llm,
    tools=curriculum_tools,
    response_format=ToolStrategy(
        CertificationCurriculum
    ),
    system_prompt="""
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

                    {{
                     "name": "",
                     "description": "",
                     "middleCategories": []
                    }}


                    Middle Category format:

                    {{
                     "name": "",
                     "description": "",
                     "lessons": []
                    }}


                    Lesson format:

                    {{
                     "name": "",
                     "learning_objective": "",
                     "lessonGenerationInstructions": {{}}
                    }}


                    lessonGenerationInstructions must contain:

                    - introduction
                      - prerequisites
                      - motivation
                      - certification_relevance
                      - industry_importance

                    - concepts
                    - learning_progression
                    - technical_topics
                    - visual_recommendations
                    - real_world_applications
                    - comparisons
                    - common_mistakes
                    - best_practices
                    - relationships
                    - certification_focus
                    - expected_learner_outcome


                    Rules:

                    - Follow beginner to advanced progression.
                    - Avoid duplicate topics.
                    - Cover exam objectives.
                    - Do not generate lesson content.
                    - Do not create quizzes.
                    - Do not create assessments.
                    - Do not explain concepts.
                    - Output only JSON.



                    """
)