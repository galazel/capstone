from pydantic import BaseModel, Field


class StudyAidItem(BaseModel):
    question: str
    # Quiz-only: 4 plain-text options, with `correctAnswer` holding the exact
    # text of the right one. Flashcard-only: `answer` is the back of the
    # card. Both live on one model rather than a union because the Java
    # gateway's `persistGeneratedSet` reads whichever pair applies by `type`,
    # not by discriminating on the JSON shape.
    choices: list[str] = Field(default_factory=list)
    correctAnswer: str = ""
    answer: str = ""
    explanation: str = ""
    difficulty: str = "AVERAGE"


class StudyAidSet(BaseModel):
    title: str
    items: list[StudyAidItem]
