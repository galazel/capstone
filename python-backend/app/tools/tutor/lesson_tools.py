from langchain_core.tools import tool
from app.schemas.tutor.learner_data import AdaptiveQuestionRecommendation
from typing import Literal


@tool("get_lesson_mastery")
def get_lesson_mastery(
    learner_id: int,
    lesson_id: int
) -> AdaptiveQuestionRecommendation:
    """
    Retrieve the learner's mastery percentages for the specified lesson and
    recommend the next question difficulty for adaptive learning.
    """

    # TODO:
    # Query PostgreSQL
    # SELECT easy_mastery, medium_mastery, hard_mastery
    # FROM learner_lesson_mastery
    # WHERE learner_id=? AND lesson_id=?

    return AdaptiveQuestionRecommendation(
        lesson_id=lesson_id,
        easy_mastery=20.0,
        medium_mastery=30.0,
        hard_mastery=80.0,
        recommended_difficulty="EASY",
        reason="Easy mastery is the lowest and should be strengthened first."
    )

@tool("get_questions")
def get_questions(
    learner_id: int,
    lesson_id: int,
    difficulty: Literal["EASY", "MEDIUM", "HARD"],
    question_count: int = 10
):
    """
    Retrieve adaptive practice questions for a lesson based on the
    recommended difficulty.

    The tool should:
    - Retrieve questions only from the specified lesson.
    - Retrieve only questions matching the requested difficulty.
    - Exclude questions the learner has already mastered or recently answered.
    - Return a balanced mix of available question types
      (Multiple Choice, Short Answer, Descriptive, Programming, Diagram)
      whenever possible.
    """

    # TODO:
    # 1. Query the database
    # 2. Filter by lesson_id
    # 3. Filter by difficulty
    # 4. Exclude previously answered/mastered questions
    # 5. Randomly select question_count questions

    return []

generation_tools = [
    get_lesson_mastery,
    get_questions,
]