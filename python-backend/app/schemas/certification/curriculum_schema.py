from pydantic import BaseModel
from typing import List


class LessonIntroduction(BaseModel):
    prerequisites: List[str]
    motivation: str
    certification_relevance: str
    industry_importance: str


class LessonGenerationInstructions(BaseModel):
    introduction: LessonIntroduction
    concepts: List[str]
    learning_progression: List[str]
    technical_topics: List[str]
    visual_recommendations: List[str]
    real_world_applications: List[str]
    comparisons: List[str]
    common_mistakes: List[str]
    best_practices: List[str]
    relationships: List[str]
    certification_focus: List[str]
    expected_learner_outcome: str


class Lesson(BaseModel):
    name: str
    learning_objective: str
    lessonGenerationInstructions: LessonGenerationInstructions


class MiddleCategory(BaseModel):
    name: str
    description: str
    lessons: List[Lesson]


class MajorCategory(BaseModel):
    name: str
    description: str
    middleCategories: List[MiddleCategory]


class Curriculum(BaseModel):
    majorCategories: List[MajorCategory]


class CertificationCurriculum(BaseModel):
    certification_name: str
    curriculum: Curriculum
    status: str