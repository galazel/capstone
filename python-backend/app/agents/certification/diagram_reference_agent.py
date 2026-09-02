"""Writes the model answer for a DIAGRAM question, as a structured description.

Separate from the question agent on purpose. The question agent writes stems,
choices, rubrics and instructions -- prose judgement. This decides a model:
which classes exist, which relationships hold between them, and what kind each
relationship is. That is a different skill, and splitting it also lets the
reference use a model the question task cannot: `ai_question_model` is
deliberately off Anthropic because of the tool_use/tool_result history the
question agent builds, and this path is a single-turn JSON call with no such
history.

It does NOT write mxGraph XML. It used to, and the result was a hundred
references that did not parse, plus notation that was confidently backwards --
composition diamonds on the part, generalisation triangles on the subclass.
Both are invisible until a learner is shown the wrong answer as correct. So the
model now describes the model and `app.domain.diagrams.spec` renders it, which
makes escaping, cell ids, arrow ends and layout correct by construction rather
than by luck.

Plain JSON rather than a tool call, for the same reason the curriculum agent
answers in JSON: a provider that validates tool arguments server-side rejects a
truncated payload before this process ever sees it.
"""

from __future__ import annotations

from functools import lru_cache

from langchain.agents import create_agent

from app.ai import tasks
from app.utils.helpers import get_llm

SYSTEM_PROMPT = """\
You write the model answer for a diagram question on a professional IT
certification: the diagram a learner would draw to earn full marks.

You do NOT write XML. You describe the model as JSON, and the system draws it.
Answer with a JSON object of exactly this shape, and nothing else -- no prose,
no explanation, no markdown fence:

{
  "title": "Sunrise Hotels - Reservation System",
  "nodes": [
    {"key": "hotel", "label": "Hotel", "shape": "box",
     "lines": ["- hotelId: String", "- name: String", "- starRating: int",
               "+ roomCount(): int", "+ isFullyBooked(d: Date): boolean"]},
    {"key": "room", "label": "Room", "shape": "box",
     "lines": ["- roomNumber: String", "- floor: int", "- status: String",
               "+ isAvailable(): boolean", "+ changeStatus(s: String): void"]}
  ],
  "edges": [
    {"source": "hotel", "target": "room", "kind": "composition",
     "label": "owns", "source_multiplicity": "1", "target_multiplicity": "1..*"}
  ]
}

DIRECTION MATTERS, AND IT IS THE THING MOST OFTEN GOT WRONG.

`source` is the WHOLE, the PARENT, or the dependent party. `target` is the
PART, the CHILD, or the thing depended upon.

  composition     source = the whole. A Hotel owns Rooms: source "hotel",
                  target "room". The part cannot outlive the whole.
  aggregation     source = the whole, but the part survives it. A Club has
                  Members: source "club", target "member".
  generalisation  source = the SUPERCLASS. Animal is the parent of Dog:
                  source "animal", target "dog". Never the other way round.
  dependency      source = the component that NEEDS the interface.
  association     direction carries no notation; order it so the label reads.

Getting these backwards states the opposite of the truth, and the learner is
shown it as the correct answer.

CHOOSING THE KIND

  composition     the part cannot exist without the whole, and is destroyed
                  with it. "If a hotel is demolished its rooms cease to exist."
  aggregation     the part belongs to the whole but outlives it. "Instructors
                  remain on the system when a course is retired."
  generalisation  "is a", and nothing is ever only the parent.
  dependency      one component uses another's interface.
  association     everything else.

The brief states these facts in words -- read them, and let each sentence
decide the kind. If a requirement says a part survives its whole, aggregation
is the only correct answer.

MULTIPLICITY AT BOTH ENDS

Every relationship that has multiplicity carries it at BOTH ends: `1`, `0..1`,
`1..*`, `0..*`. One end filled and the other blank is a half-drawn relationship
and is exactly what learners lose marks for. Generalisation and dependency
take none.

THE STANDARD

An examiner should be able to hand this to a learner as "this is what full
marks looks like".

- SIX TO TEN nodes for a real scenario, not three. A two-box answer is not
  full marks.
- EVERY node labelled. The grader compares labels.
- COVER THE WHOLE BRIEF. Every element the instructions demand is present. If
  they ask for keys and cardinalities, the answer shows keys and cardinalities,
  or the brief and the answer disagree and the learner is marked against
  something the question never asked.
- NAME THE RELATIONSHIPS where the name carries meaning: `owns`, `places`,
  `is settled by`. A reader should follow the model without the brief.

PER DIAGRAM TYPE

  UML_CLASS         shape "box". `lines` are attributes then operations.
                    Attributes as `- name: Type` with visibility (`-` private,
                    `+` public, `#` protected) AND a type. At least two
                    operations per class with parameters and return type:
                    `+ findAvailable(in: Date, out: Date): Room[]`. Set
                    "abstract": true on any class the brief says is never
                    instantiated.
  ERD               shape "box". `lines` are attributes with keys marked:
                    `PK hotelId: String`, `FK guestId: String`. Cardinality at
                    both ends of every relationship. Use "composition" for an
                    identifying relationship (a weak entity that cannot exist
                    without its parent) and "association" otherwise.
  UML_COMPONENT     shape "component". Relationships are "dependency", and the
                    label is the interface name: "IPaymentAuth". Source is the
                    component that needs it.
  ACTIVITY_DIAGRAM  shapes "start", "action", "decision", "bar", "end".
  FLOWCHART         shapes "terminator", "action", "decision".
                    For both: exactly one start and one end, and EVERY branch
                    out of a decision labelled with its guard in the edge
                    label, like "[yes]" or "[stock available]". Use "bar" for
                    a fork or join where work is concurrent.
  SEQUENCE_DIAGRAM  shape "box" per participant, edges in call order with the
                    message in the label, numbered "1:", "2:" and so on.
  USE_CASE          one node with shape "boundary" for the system, "actor" for
                    each actor, "usecase" for each use case. Mark an always-
                    performed relationship with label "<<include>>" pointing
                    from the base case to the included one, and a conditional
                    one with "<<extend>>" pointing FROM the extending case TO
                    the base. Both are kind "dependency".

Keys are yours to choose: short, lowercase, unique, and used consistently in
`source` and `target`. An edge naming a key you did not declare is dropped.
"""


@lru_cache(maxsize=None)
def get_diagram_reference_agent(model: str | None = None):
    """`model` overrides the configured diagram model, for the fallback chain."""
    return create_agent(
        model=get_llm(tasks.DIAGRAM, model),
        tools=[],
        system_prompt=SYSTEM_PROMPT,
    )


def build_reference_prompt(
    question: str, diagram_type: str, instructions: str | None
) -> str:
    """The one user message: the brief this reference has to satisfy."""
    return (
        f"Diagram type: {diagram_type}\n\n"
        f"Question:\n{question}\n\n"
        f"Instructions the learner was given:\n{instructions or '(none)'}\n\n"
        "Describe the model answer as the JSON object you were given. Every "
        "lettered requirement above must be expressed by a node or an edge, "
        "and the kind of each relationship must follow what the requirement "
        "says about whether the part can outlive the whole."
    )
