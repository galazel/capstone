from functools import lru_cache

from app.tools.certification.curriculum_tools import curriculum_tools
from langchain.agents import create_agent
from app.utils.helpers import get_llm
from app.core.config import get_settings

_PROMPT_TEMPLATE = """
                    You are REBYU Curriculum Planning Agent.

                    Create a professional certification curriculum blueprint.

                    You are planning the SYLLABUS, not writing it. Each lesson
                    is one short entry -- a name, an objective, and the topics
                    it covers. The lesson text itself is written later by a
                    different agent.

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


                    Lesson format -- exactly these three fields, nothing more:

                    {
                     "name": "",
                     "learning_objective": "",
                     "key_topics": ["", ""]
                    }


                    key_topics is 3 to 6 short topic phrases the lesson must
                    cover. It is ALWAYS a JSON array of strings -- write
                    ["value"], never "value", even for a single entry. Keep
                    each phrase to a few words; do not write sentences,
                    explanations, or lesson content here.


                    Exam structure:

                    Alongside "majorCategories", return ONE "exam_structure"
                    object describing the REAL certification exam -- not the
                    curriculum. The mock exam is built from it, so it decides
                    how many questions that exam has and what kinds:

                    {
                     "total_items": 0,
                     "question_types": ["MCQ"],
                     "notes": ""
                    }

                    - total_items: how many questions the real exam has. Use
                      the official number when you know it (search for it if
                      unsure). Use 0 only when you genuinely do not know.
                    - question_types: the formats the real exam uses. Some
                      certifications are MCQ only; TOPCIT, for example, also
                      uses SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING and DIAGRAM.
                      Use only these five names.
                    - notes: sections, weighting, sub-questions, time limit --
                      anything else that shapes the paper. A few sentences.


                    Size:

{size}

                    Rules:

                    - Follow beginner to advanced progression.
                    - Avoid duplicate topics.
                    - Cover every exam objective, not just the first few.
                    - Do not generate lesson content.
                    - Do not create quizzes.
                    - Do not create assessments.
                    - Do not explain concepts.


                    Answer format:

                    Your final message is ONE JSON object and nothing else --
                    no preamble, no explanation, no ``` fences:

                    {
                     "majorCategories": [],
                     "exam_structure": {}
                    }

                    - "exam_structure" is a key of that top-level object,
                      a sibling of "majorCategories". Never put it inside a
                      Major Category.
                    - Close every bracket you open. The object ends with the
                      "]" that closes "majorCategories" and the "}" that
                      closes the object itself. Nothing may follow it.



                    """


_INDENT = " " * 20


def _count(low: int, high: int, singular: str, plural: str) -> str:
    if low == high:
        return f"Exactly {low} {singular if low == 1 else plural}"
    return f"{low} to {high} {plural}"


def _size_section(settings) -> str:
    """The Size block, built from the configured ask.

    Configurable so the whole workflow can be exercised on a small AI budget
    (see `curriculum_min_majors` and friends in `app.core.config`). The
    "match a real syllabus" push is dropped when the ask is deliberately
    small -- telling the model a certification has dozens of lessons and then
    asking it for one is a contradiction it resolves by ignoring one of them.
    """
    lines = [
        "A curriculum is the whole certification, not a sample of it. Produce:",
        "",
        f"- {_count(settings.curriculum_min_majors, settings.curriculum_max_majors, 'Major Category', 'Major Categories')}",
        f"- {_count(settings.curriculum_min_middles, settings.curriculum_max_middles, 'Middle Category', 'Middle Categories')} inside EVERY Major Category",
        f"- {_count(settings.curriculum_min_lessons, settings.curriculum_max_lessons, 'Lesson', 'Lessons')} inside EVERY Middle Category",
        "",
    ]

    if settings.curriculum_max_majors > 1 or settings.curriculum_max_lessons > 1:
        lines += [
            "Never stop after one Major Category, and never leave a Middle",
            "Category with a single lesson. A real certification syllabus has",
            "dozens of lessons; match its breadth.",
        ]
    else:
        lines += [
            "These counts are exact. Produce no more than asked -- choose the",
            "single most important area of the certification and cover that,",
            "rather than trying to summarise the whole syllabus in one lesson.",
        ]

    return "\n".join(f"{_INDENT}{line}".rstrip() for line in lines)


def build_system_prompt() -> str:
    # `.replace`, not `.format`: the template is full of literal JSON braces
    # showing the model the shapes to emit, and every one would have to be
    # doubled to survive formatting.
    return _PROMPT_TEMPLATE.replace("{size}", _size_section(get_settings()))


@lru_cache(maxsize=None)
def get_curriculum_agent(model: str | None = None):
    """Plans the syllabus outline and nothing else.

    Deliberately has no `response_format`. Every other agent here uses
    `ToolStrategy`, but the planner's output is the one large enough that the
    model routinely stops before closing its brackets -- and Groq validates
    tool arguments server-side, so a curriculum missing its final `]}` was
    rejected as HTTP 400 before this process ever saw it. Five samples in a row
    died that way and failed the run. The answer comes back as plain JSON
    instead and is parsed, repaired, and validated against `Curriculum` in
    `app.ai.json_output` -- which is also, at last, where the un-nesting
    repairs in `app.schemas.certification.curriculum_schema` get to run.

    The shape is `Curriculum` directly rather than a wrapper carrying
    `certification_name` and `status`: both were fields the model had to place
    correctly and nothing downstream read, and `status` was the one it
    misplaced most often.
    """
    return create_agent(
        model=get_llm("generation", model),
        tools=curriculum_tools,
        system_prompt=build_system_prompt(),
    )