from langgraph.graph import MessagesState
from app.schemas.tutor.generation_schemas import QuestionFormat


class TutorState(MessagesState):
    learnerId: int
    lessonId: int

    instructions: str
    generation_type: str
    items: int

    request: str | None

    questions: QuestionFormat | None

    summary: str | None