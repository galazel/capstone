from pydantic import BaseModel
from typing import List


class FlashcardFormat(BaseModel):
    front: str
    back: str

class ChoiceFormat(BaseModel):
    isCorrect: bool
    choice_text: str

class MultipleChoiceFormat(BaseModel):
    question: str
    choices: List[ChoiceFormat]

class QuestionFormat(BaseModel):
    question: List[dict]
    instructions: str
    isTimed: bool
