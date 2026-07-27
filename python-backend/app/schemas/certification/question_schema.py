from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

QuestionType = Literal["MCQ", "SHORT_ANSWER", "DESCRIPTIVE", "PROGRAMMING", "DIAGRAM"]
Difficulty = Literal["EASY", "AVERAGE", "DIFFICULT"]

# Bloom's cognitive levels, lowest to highest. Ordered so coverage analysis
# can reason about the distribution rather than just counting distinct values.
BloomLevel = Literal["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]

BLOOM_ORDER: tuple[str, ...] = (
    "REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE",
)

MCQ_CHOICE_COUNT = 4


class ProgrammingTestCase(BaseModel):
    input_data: str
    expected_output: str


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
            if not self.test_cases:
                raise ValueError("PROGRAMMING must include at least one test case")

        elif self.question_type == "DIAGRAM":
            if not (self.diagram_type or "").strip():
                raise ValueError("DIAGRAM must set diagram_type")
            if not (self.instructions or "").strip():
                raise ValueError("DIAGRAM must set instructions")

        if self.estimated_seconds <= 0:
            raise ValueError("estimated_seconds must be positive")

        return self


class QuestionBatch(BaseModel):
    scope: str
    questions: List[QuestionDraft]
