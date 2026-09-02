from functools import lru_cache

from app.ai import tasks
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

                    KEY_TOPICS IS WHERE COVERAGE IS PROVED. Every substantive
                    topic in the source documents must appear in some lesson's
                    key_topics. That -- not the number of lessons -- is how
                    this curriculum demonstrates it covers the whole domain,
                    and it is checked against the documents. A topic you leave
                    out of every key_topics list is a topic the certification
                    does not teach, whatever the lesson titles suggest.

                    The lesson author is given this list and must teach every
                    entry on it, so a lesson carrying six topics teaches six
                    topics -- it does not mention them and move on.


                    Exam structure:

                    Alongside "majorCategories", return ONE "exam_structure"
                    object describing the REAL certification exam -- not the
                    curriculum. EVERY assessment this run produces is built
                    from it: the diagnostic, the mock exam and the question
                    bank all read it, so research it properly rather than
                    filling in defaults.

                    {
                     "total_items": 0,
                     "question_types": ["MCQ"],
                     "duration_minutes": 0,
                     "passing_score": 0,
                     "coverage": "",
                     "notes": ""
                    }

                    - total_items: how many questions the real exam has. Use
                      the official number when you know it (search for it if
                      unsure). Use 0 only when you genuinely do not know.
                    - question_types: DECIDE which formats this particular
                      certification actually examines. Use only these five
                      names: MCQ, SHORT_ANSWER, DESCRIPTIVE, PROGRAMMING,
                      DIAGRAM.

                      This is a judgement to make, not a field to default.
                      Work from the official paper when you can find it. When
                      you cannot, decide from what the certification is FOR --
                      what it certifies someone is able to do:

                        * PROGRAMMING when passing it means you can write
                          code -- software engineering, development, most
                          data-engineering credentials.
                        * DIAGRAM when it means you can model a system --
                          anything examining database design, UML, software
                          architecture, network topology, process modelling.
                        * DESCRIPTIVE when it means you can justify a
                          decision -- architecture, security, management,
                          audit, anything where the reasoning is the skill.
                        * SHORT_ANSWER for exact recall of terms, values and
                          notation.
                        * MCQ is in nearly every paper, but a list containing
                          ONLY MCQ is a real claim: it says this certification
                          never asks the candidate to produce anything. That
                          is true of some foundational papers and false of
                          most professional ones, so do not put it there by
                          default.

                      Every listed type is generated at every level -- lesson
                      quizzes, unit exams, the diagnostic, the mock and the
                      bank -- so list what the certification genuinely
                      examines, not everything imaginable.
                    - duration_minutes: how long the real paper allows. The
                      mock exam is stored with this as its time limit, so a
                      learner sits it under the same clock. 0 if unknown.
                    - passing_score: the official pass mark as a percentage
                      (e.g. 60, 70, 80). 0 if unknown.
                    - coverage: the official domains the exam examines and
                      their weightings, as the certification body states them
                      -- "Software Development 40%, Database 25%, ...". This is
                      what gets EXAMINED, which is not always weighted like the
                      syllabus that gets taught. A few lines.
                    - notes: sections, ordering, sub-question structure,
                      permitted materials -- anything else that shapes the
                      paper. A few sentences.


                    Work in this order:

                    1. FIND OUT WHAT THE CERTIFICATION COVERS, BEFORE deciding
                       any lesson. Establish exam_structure.coverage first --
                       the official domains and their weightings -- by
                       searching for the certification body's own syllabus and
                       reading what the uploaded documents are organised into.
                       You cannot judge whether a curriculum covers a
                       certification until you know what the certification
                       examines.

                    2. List the topics inside each of those domains, from the
                       documents. This inventory is what goes into the
                       lessons' key_topics.

                    3. ONLY THEN build majorCategories, grouping that
                       inventory into lessons.

                    The result must line up with step 1: every domain in
                    coverage has major categories teaching it, and its share of
                    the curriculum roughly matches its weighting in the exam.
                    A domain the certification examines and this curriculum
                    skips is the one failure that matters most -- a learner who
                    studies it all and is then examined on something never
                    taught was failed by the plan, not by their studying.


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
    if settings.curriculum_autosize:
        # No counts at all. Naming a range here would anchor the model to it
        # regardless of what the document holds, which is the whole thing this
        # mode exists to avoid.
        lines = [
            "A curriculum is the whole certification, not a sample of it.",
            "",
            "Decide the structure from the SOURCE MATERIAL. How many Major",
            "Categories, Middle Categories and Lessons there should be is",
            "determined by what the document actually covers -- its own",
            "chapters, sections and topics -- not by any fixed number.",
            "",
            "COVER EVERYTHING THE DOCUMENTS TEACH. The source material is the",
            "syllabus. Every substantive topic in it earns a place in the",
            "curriculum -- walk the documents through and account for all of",
            "it. A learner who studies this certification end to end should",
            "not meet anything in the real exam that these documents covered",
            "and the curriculum skipped.",
            "",
            "COVERAGE LIVES IN key_topics, NOT IN THE LESSON COUNT. Every",
            "substantive topic the documents teach must appear in some",
            "lesson's key_topics list. Do NOT give each topic its own lesson",
            "to prove you covered it -- a lesson carries 3 to 6 related topics",
            "and teaches all of them, so grouping loses nothing. Splitting",
            "instead of grouping produces a syllabus so long it cannot be",
            "written, which covers less than a shorter one that names",
            "everything.",
            "",
            "So: enumerate the domain exhaustively in key_topics, and keep the",
            "LESSONS at a workable number by grouping related topics together.",
            "A hundred topics is roughly twenty lessons, not a hundred.",
            "",
            "GROUP WHAT IS TAUGHT TOGETHER. Topics a learner would study in",
            "one sitting -- the same technique from several angles, a concept",
            "and its variations, a process and its steps -- belong in ONE",
            "lesson, listed as separate key_topics. Split only when a single",
            "topic genuinely needs a full sitting of its own, such as a long",
            "worked procedure the learner must follow end to end.",
            "",
            "A lesson must still be a whole unit of study, not a definition",
            "with a heading on it. If something would amount to a couple of",
            "sentences, it is a key_topic inside a lesson, never a lesson.",
            "",
            "CATEGORIES follow the documents too. Use the domains, parts or",
            "chapters the material itself is organised into rather than",
            "inventing a tidier scheme, and let a Major Category hold as many",
            "Middle Categories as its material needs.",
            "",
            "Every Major Category needs at least one Middle Category, and",
            "every Middle Category at least one Lesson.",
        ]

        # The qualitative push above is not enough on its own. Measured on a
        # real run: told to prioritise and merge but given no number, the
        # planner still produced more than thirty lessons and had its tail
        # trimmed. Trimming loses material silently; a stated ceiling makes the
        # model do the consolidating itself, which is the whole point. This is
        # a LIMIT, not a target -- the wording has to stop it treating the
        # number as a quota to fill.
        cap = settings.curriculum_autosize_max_lessons
        if cap > 0:
            lines += [
                "",
                f"HARD LIMIT: no more than {cap} Lessons IN TOTAL across the",
                "entire certification -- not per category, per certification.",
                "This is a ceiling, not a target: if the material genuinely",
                f"needs fewer than {cap}, produce fewer. If it seems to need",
                "more, you have not consolidated enough -- merge related",
                "lessons until it fits, keeping the most central material.",
                f"A plan longer than {cap} will have its final lessons cut off",
                "entirely, so anything you leave to the end is lost rather",
                "than shortened.",
            ]
        return "\n".join(f"{_INDENT}{line}".rstrip() for line in lines)

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
        model=get_llm(tasks.CURRICULUM, model),
        tools=curriculum_tools,
        system_prompt=build_system_prompt(),
    )