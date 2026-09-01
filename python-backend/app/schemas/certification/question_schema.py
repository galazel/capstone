import logging
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)

QuestionType = Literal["MCQ", "SHORT_ANSWER", "DESCRIPTIVE", "PROGRAMMING", "DIAGRAM"]
#: Canonical difficulty vocabulary. HARD, not DIFFICULT.
#:
#: This used to say DIFFICULT while `mastery.py` said HARD, and the two were
#: never reconciled -- so generation wrote DIFFICULT into `questions`, and the
#: Java side (`BktEventFactory.KNOWN_DIFFICULTY`, which knows only EASY/
#: AVERAGE/HARD) then silently collapsed every one of those to its AVERAGE
#: fallback. The effect was not a cosmetic duplicate: hard questions were
#: reported to BKT as average ones, so guess/slip were fitted against the
#: wrong difficulty class.
Difficulty = Literal["EASY", "AVERAGE", "HARD"]

#: Accepted spellings that are normalised to a canonical value. DIFFICULT is
#: kept as an alias rather than rejected because it is what the prompts asked
#: for until now: existing drafts still carry it, and a model told "HARD" will
#: still occasionally answer "DIFFICULT". Silently correcting it is better
#: than failing a whole generation over a synonym.
DIFFICULTY_ALIASES = {"DIFFICULT": "HARD"}

# Bloom's cognitive levels, lowest to highest. Ordered so coverage analysis
# can reason about the distribution rather than just counting distinct values.
BloomLevel = Literal["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]

BLOOM_ORDER: tuple[str, ...] = (
    "REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE",
)

MCQ_CHOICE_COUNT = 4

#: Shared with `app.domain.validation.questions`, which reports the same floor
#: as an advisory issue for questions that came from somewhere other than a
#: fresh generation (a reviewer's manual edit, say).
MIN_EXPLANATION_CHARS = 20

#: A programming task needs enough cases to check the edges it states, not
#: just that the happy path runs. Mirrored in
#: `app.domain.validation.questions`, which reports the same floor for
#: questions that never went through generation.
MIN_PROGRAMMING_TEST_CASES = 3

#: The diagram types a DIAGRAM question may ask for.
#:
#: These are the values the *editor* already offers
#: (`DIAGRAM_TYPE_OPTIONS` in `frontend/src/components/questions/
#: question-editors.jsx`) and the values the diagram playground keys its tool
#: palette on: a question whose `diagram_type` is not one of them lands the
#: learner in a canvas holding some other diagram's shapes, because the
#: playground falls back to ERD for anything it does not recognise.
#:
#: The field used to be free text, so the model wrote "ERD", "er diagram" and
#: "Entity Relationship Diagram" for the same thing and only the first one
#: matched.
DIAGRAM_TYPES: tuple[str, ...] = (
    "ACTIVITY_DIAGRAM",
    "UML_CLASS",
    "UML_COMPONENT",
    "ERD",
    "FLOWCHART",
    "SEQUENCE_DIAGRAM",
    "USE_CASE",
)

#: What a model actually writes, mapped onto the canonical value. Matching is
#: on the alphanumeric core of the string, so "UML Class", "uml-class" and
#: "Class Diagram" all arrive at UML_CLASS.
_DIAGRAM_TYPE_ALIASES = {
    "activity": "ACTIVITY_DIAGRAM",
    "activitydiagram": "ACTIVITY_DIAGRAM",
    "umlactivity": "ACTIVITY_DIAGRAM",
    "umlactivitydiagram": "ACTIVITY_DIAGRAM",
    "class": "UML_CLASS",
    "classdiagram": "UML_CLASS",
    "umlclass": "UML_CLASS",
    "umlclassdiagram": "UML_CLASS",
    "component": "UML_COMPONENT",
    "componentdiagram": "UML_COMPONENT",
    "umlcomponent": "UML_COMPONENT",
    "umlcomponentdiagram": "UML_COMPONENT",
    "er": "ERD",
    "erd": "ERD",
    "erdiagram": "ERD",
    "entityrelationship": "ERD",
    "entityrelationshipdiagram": "ERD",
    "flow": "FLOWCHART",
    "flowchart": "FLOWCHART",
    "flowdiagram": "FLOWCHART",
    "processflowchart": "FLOWCHART",
    "sequence": "SEQUENCE_DIAGRAM",
    "sequencediagram": "SEQUENCE_DIAGRAM",
    "umlsequence": "SEQUENCE_DIAGRAM",
    "umlsequencediagram": "SEQUENCE_DIAGRAM",
    "usecase": "USE_CASE",
    "usecasediagram": "USE_CASE",
    "umlusecase": "USE_CASE",
    "umlusecasediagram": "USE_CASE",
}


def normalize_diagram_type(value: str | None) -> str | None:
    """Maps whatever was written onto one of `DIAGRAM_TYPES`, or None.

    None means "not a diagram type this product can present", which the
    validator turns into a rejection so the model is asked again -- rather
    than storing a type the playground cannot equip and the learner meets as
    the wrong set of shapes.
    """
    key = "".join(ch for ch in (value or "").lower() if ch.isalnum())
    if not key:
        return None
    canonical = key.upper()
    if canonical in DIAGRAM_TYPES:
        return canonical
    # "UML_CLASS" arrives as "umlclass" once punctuation is stripped.
    stripped = {"".join(c for c in t.lower() if c.isalnum()): t for t in DIAGRAM_TYPES}
    if key in stripped:
        return stripped[key]
    return _DIAGRAM_TYPE_ALIASES.get(key)


#: Lower than the item-level floor because a per-choice note is one sentence
#: about one distractor, but high enough to reject "Incorrect." / "Wrong.",
#: which teach nothing.
MIN_CHOICE_EXPLANATION_CHARS = 15

#: SHORT_ANSWER is graded by normalised *exact string match* -- see
#: `app.domain.persistence.checking_method_for`, which maps it to
#: EXACT_MATCH while DESCRIPTIVE gets semantic grading. So an open-ended
#: short-answer question is not merely poor style: there is no string the
#: learner can type that will be marked correct, and they lose the points
#: however well they answer.
#:
#: A live run produced "What is the importance of defining the scope of the
#: problem domain?" as SHORT_ANSWER/EASY/UNDERSTAND. That question is fine --
#: it is just a DESCRIPTIVE one, which is the type that carries a rubric and
#: is graded on meaning rather than characters.
_OPEN_ENDED_STEMS = (
    "importance of",
    "significance of",
    "benefits of",
    "advantages and disadvantages",
    "why is",
    "why are",
    "why do",
    "discuss",
    "explain",
    "describe",
    "elaborate",
    "justify",
    "compare",
    "contrast",
    "in your own words",
    "what do you think",
    "how would you",
    "what are the implications",
)

#: The other shape that cannot be exact-matched: a question asking for a *set*
#: of things rather than one thing.
#:
#: A live run produced "What are the five core activities of the requirements
#: definition process?" as SHORT_ANSWER. It passes every check above -- no
#: open-ended stem, and an answer like "Elicitation, analysis, specification,
#: validation, management" is five words, inside the word limit -- yet no
#: learner will ever reproduce that exact string, in that exact order, with
#: that exact punctuation. An enumeration has many correct spellings and no
#: canonical one, which is precisely what exact matching cannot handle.
#:
#: Matched on the stem rather than the answer on purpose. The answer to a
#: legitimate expansion question ("What does ACID stand for?") is also a
#: comma-separated list, but it has one canonical form and is a fair exact
#: match; the difference lives in what was asked, not in how the answer is
#: punctuated.
_ENUMERATION_STEMS = (
    "what are the",
    "which are the",
    "name the",
    "list the",
    "list three",
    "list four",
    "list five",
    "enumerate",
    "state the",
    "identify the",
    "give the",
    "what steps",
    "what phases",
    "what stages",
)

#: "the five core activities", "the 3 phases" -- a counted set, whatever verb
#: introduces it. Catches enumerations the stem list above misses, e.g.
#: "A requirements process has the five activities of ...?".
#: Units are excluded, and that exclusion is not hypothetical: three live
#: questions ask "...long-term goals, typically spanning 3-5 years?" with the
#: one-term answer "Strategic objectives". Without the carve-out, "5 years"
#: reads as a counted set and a perfectly good exact-match question loses its
#: exact matching. A quantity of time or size is a measurement, never a set of
#: concepts to enumerate.
_COUNTED_UNIT_NOUNS = (
    "years", "months", "weeks", "days", "hours", "minutes", "seconds",
    "decades", "times", "bytes", "bits", "digits", "characters", "percent", "points", "marks",
)

_COUNTED_SET_PATTERN = re.compile(
    r"\b(?:two|three|four|five|six|seven|eight|nine|ten|[2-9]|10)\s+"
    r"(?!(?:" + "|".join(_COUNTED_UNIT_NOUNS) + r")\b)\w+s\b"
)

#: A genuine short answer is a term, name, value, or acronym -- "Normalization",
#: "3NF", "O(n log n)". Anything longer is prose, and prose cannot be matched
#: character-for-character.
SHORT_ANSWER_MAX_WORDS = 6


class ProgrammingTestCase(BaseModel):
    input_data: str
    expected_output: str


class SubQuestionDraft(BaseModel):
    """One part of a critical-thinking question.

    A PROGRAMMING or DIAGRAM item is a scenario a learner works through, and
    the parts are the questions asked *about* that scenario -- explain the
    trade-off, justify the cardinality, describe what breaks under load. The
    product has always modelled them (`subQuestions` in the question editor,
    `parent_question_id` in the schema, and a grader that marks the whole set
    in one holistic call) and the generator had no field to put them in, so
    every generated critical-thinking item arrived as a bare prompt with no
    parts. That is the whole difference between a workspace task and a
    question with a big text box.

    Written answers, always: the part is reasoning about the artifact, not a
    second artifact. `rubric_answer` is what the AI grader marks against.
    """

    question: str
    rubric_answer: str = ""
    points: float = 1.0


class QuestionDraft(BaseModel):
    """One generated question.

    The per-type rules below were previously stated *only* in the agent's
    system prompt (`question_agent.SYSTEM_PROMPT`) -- i.e. they were requests,
    not constraints, and a model that ignored them produced a structurally
    broken question that flowed straight through to an admin. They are now
    enforced here, so a violation raises and the shared retry policy asks the
    model again.
    """

    question_type: QuestionType
    question: str
    difficulty: Difficulty = "AVERAGE"
    explanation: str = ""

    @field_validator("difficulty", mode="before")
    @classmethod
    def _normalise_difficulty(cls, value: object) -> object:
        """Upper-cases and maps known synonyms onto the canonical vocabulary."""
        if not isinstance(value, str):
            return value
        upper = value.strip().upper()
        return DIFFICULTY_ALIASES.get(upper, upper)

    # --- pedagogical metadata (Phase 2b step 10) --------------------------
    # Needed for the validation layer to reason about cognitive balance and
    # objective coverage, and for adaptive selection to target a learner's
    # actual gap rather than just a topic.
    bloom_level: BloomLevel = "UNDERSTAND"
    learning_objective: str = ""
    lesson_ref: Optional[str] = None
    category_ref: Optional[str] = None
    estimated_seconds: int = 60
    # Chunk ids this question was grounded in, for hallucination tracing.
    source_chunk_ids: List[str] = Field(default_factory=list)

    # MCQ
    choices: List[str] = Field(default_factory=list)
    correct_choice_index: Optional[int] = None
    #: One explanation per choice, in the same order as `choices`: why that
    #: option is right, or why it is wrong. Required for MCQ.
    #:
    #: The `choices` table has carried a per-choice `explanation` column all
    #: along, but only the correct choice's was ever filled -- so a learner who
    #: picked a distractor was told what the right answer was without ever
    #: learning why their own answer failed, which is the half that corrects a
    #: misconception.
    choice_explanations: List[str] = Field(default_factory=list)

    # SHORT_ANSWER
    correct_answer: Optional[str] = None

    # DESCRIPTIVE
    rubric_answer: Optional[str] = None

    # PROGRAMMING
    starter_code: Optional[str] = None
    test_cases: List[ProgrammingTestCase] = Field(default_factory=list)

    # DIAGRAM
    diagram_type: Optional[str] = None
    instructions: Optional[str] = None

    #: PROGRAMMING / DIAGRAM: the parts asked about the artifact the learner
    #: produces. Empty for MCQ, short answer and descriptive items, which are
    #: single questions by definition. See `SubQuestionDraft`.
    sub_questions: List[SubQuestionDraft] = Field(default_factory=list)

    @model_validator(mode="after")
    def _reclassify_open_ended_short_answers(self) -> "QuestionDraft":
        """Turns an open-ended SHORT_ANSWER into the DESCRIPTIVE it really is.

        Repaired rather than rejected on purpose. Raising here would resample
        the whole batch, and the model reproduces this mistake reliably enough
        that a strict rule could burn a run's entire token budget without ever
        producing an acceptable sample -- for a question whose *content* is
        perfectly good and only whose type is wrong. Reclassifying keeps the
        question and makes it gradeable.

        Runs before the shape checks below so the reclassified question is then
        validated as the DESCRIPTIVE it has become.
        """
        if self.question_type != "SHORT_ANSWER":
            return self

        stem = self.question.strip().lower()
        matched = next((phrase for phrase in _OPEN_ENDED_STEMS if phrase in stem), None)
        enumeration = next(
            (phrase for phrase in _ENUMERATION_STEMS if phrase in stem), None
        )
        counted = None
        if enumeration is None:
            counted_match = _COUNTED_SET_PATTERN.search(stem)
            counted = counted_match.group(0) if counted_match else None
        too_long = len((self.correct_answer or "").split()) > SHORT_ANSWER_MAX_WORDS

        if matched is None and enumeration is None and counted is None and not too_long:
            return self

        if matched:
            reason = f"the stem asks an open-ended question ({matched!r})"
        elif enumeration:
            reason = (
                f"the stem asks for a set of things ({enumeration!r}), which has no "
                "single canonical spelling to match against"
            )
        elif counted:
            reason = (
                f"the stem asks for a counted set ({counted!r}), which has no single "
                "canonical spelling to match against"
            )
        else:
            reason = (
                f"its answer is longer than {SHORT_ANSWER_MAX_WORDS} words, so no exact "
                "match is possible"
            )
        logger.info(
            "Reclassifying SHORT_ANSWER as DESCRIPTIVE -- %s: %.80s", reason, self.question
        )

        self.question_type = "DESCRIPTIVE"
        # The intended answer becomes the grading rubric; nothing is discarded.
        if not (self.rubric_answer or "").strip():
            self.rubric_answer = (self.correct_answer or "").strip() or (
                "A correct answer explains the concept the question asks about, "
                "grounded in the lesson content."
            )
        self.correct_answer = None
        return self

    @model_validator(mode="after")
    def _enforce_type_specific_shape(self) -> "QuestionDraft":
        if not self.question.strip():
            raise ValueError("question text must not be empty")

        if self.question_type == "MCQ":
            if len(self.choices) != MCQ_CHOICE_COUNT:
                raise ValueError(
                    f"MCQ must have exactly {MCQ_CHOICE_COUNT} choices, got {len(self.choices)}"
                )
            if self.correct_choice_index is None:
                raise ValueError("MCQ must set correct_choice_index")
            if not 0 <= self.correct_choice_index < MCQ_CHOICE_COUNT:
                raise ValueError(
                    f"correct_choice_index {self.correct_choice_index} is out of range"
                )
            if len({choice.strip().lower() for choice in self.choices}) != MCQ_CHOICE_COUNT:
                raise ValueError("MCQ choices must be distinct")

        elif self.question_type == "SHORT_ANSWER":
            if not (self.correct_answer or "").strip():
                raise ValueError("SHORT_ANSWER must set correct_answer")

        elif self.question_type == "DESCRIPTIVE":
            if not (self.rubric_answer or "").strip():
                raise ValueError("DESCRIPTIVE must set rubric_answer")

        elif self.question_type == "PROGRAMMING":
            if len(self.test_cases) < MIN_PROGRAMMING_TEST_CASES:
                # One test case checks that the happy path runs and nothing
                # else, which is how a "coding question" ends up being a
                # syntax quiz. Three is the floor for covering the ordinary
                # case and the edges the problem statement describes.
                raise ValueError(
                    f"PROGRAMMING must include at least {MIN_PROGRAMMING_TEST_CASES} "
                    f"test cases covering the ordinary case and its edges"
                )

        elif self.question_type == "DIAGRAM":
            if not (self.diagram_type or "").strip():
                raise ValueError("DIAGRAM must set diagram_type")
            # Normalised in place: the model's spelling is not worth a retry
            # when the meaning is unambiguous ("ER Diagram" -> ERD), but a
            # type outside the supported set is, because the learner would
            # be handed a canvas equipped for a different diagram.
            canonical = normalize_diagram_type(self.diagram_type)
            if canonical is None:
                raise ValueError(
                    f"diagram_type '{self.diagram_type}' is not supported; use one of: "
                    + ", ".join(DIAGRAM_TYPES)
                )
            self.diagram_type = canonical
            if not (self.instructions or "").strip():
                raise ValueError("DIAGRAM must set instructions")

        if self.estimated_seconds <= 0:
            raise ValueError("estimated_seconds must be positive")

        return self


    @model_validator(mode="after")
    def _require_an_explanation(self) -> "QuestionDraft":
        """Every question must explain itself.

        This is what a learner sees after getting the item wrong, so a blank
        explanation makes the mistake unrecoverable -- they are told they were
        wrong and nothing else. It was previously only an advisory warning in
        `app.domain.validation.questions`, which meant an unexplained question
        reached an admin, and then a learner, with nothing stopping it.
        """
        if len(self.explanation.strip()) < MIN_EXPLANATION_CHARS:
            raise ValueError(
                f"every question needs an explanation of at least "
                f"{MIN_EXPLANATION_CHARS} characters, stating what the item tests "
                "and why the correct answer is correct"
            )

        if self.question_type == "MCQ":
            self._require_an_explanation_per_choice()
        return self

    def _require_an_explanation_per_choice(self) -> None:
        """Every choice explains itself -- including the ones nobody should pick.

        Enforced rather than repaired, unlike the open-ended SHORT_ANSWER case:
        there the content existed and only its label was wrong, so it could be
        fixed locally. A missing explanation cannot be invented here without
        fabricating teaching material, so the only honest options are to reject
        and resample, or to ship a distractor that says nothing about why it is
        wrong. A length mismatch is rejected for the same reason it cannot be
        silently trimmed: misaligned explanations would tell a learner their
        correct answer was wrong.
        """
        if len(self.choice_explanations) != len(self.choices):
            raise ValueError(
                f"MCQ needs one explanation per choice: got "
                f"{len(self.choice_explanations)} for {len(self.choices)} choices. "
                "Each entry says why that option is right, or which misconception "
                "makes it wrong."
            )
        for index, text in enumerate(self.choice_explanations):
            if len((text or "").strip()) < MIN_CHOICE_EXPLANATION_CHARS:
                raise ValueError(
                    f"choice {index + 1}'s explanation is empty or too short; a "
                    "learner who picked it must be told why it is wrong, not just "
                    "that it is"
                )

class QuestionBatch(BaseModel):
    scope: str
    questions: List[QuestionDraft]

