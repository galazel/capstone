from typing import TypedDict

from schemas.tutor.generation_schemas import QuestionFormat

class TutorState(TypedDict):
    learnerId: int
    lessonId: int
    instructions: str
    generation_type: str
    questions: QuestionFormat
    request: str | None
    items: int

