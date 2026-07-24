from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class RecalculateRequest(BaseModel):
    learner_id: int
    certification_id: int


class LessonPriority(BaseModel):
    lesson_id: int
    lesson_title: str | None = None
    middle_category_id: int | None = None
    major_category_id: int | None = None
    mastery_probability: float | None = None
    mastery_level: str | None = None
    priority_score: float
    priority_tag: str
    priority_label: str
    primary_reason: str | None = None
    reasons: list[str] = []
    recommended_action: str | None = None
    recommended_activity: str | None = None
    evidence_count: int = 0
    last_assessed_at: datetime | None = None


class MiddleCategoryPriority(BaseModel):
    middle_category_id: int
    major_category_id: int | None = None
    title: str | None = None
    priority_score: float
    priority_tag: str
    priority_label: str
    average_mastery: float | None = None
    weak_lesson_count: int = 0
    high_priority_lesson_count: int = 0
    critical_lesson_count: int = 0
    total_lesson_count: int = 0
    primary_reason: str | None = None
    lessons: list[LessonPriority] = []


class MajorCategoryPriority(BaseModel):
    major_category_id: int
    title: str | None = None
    priority_score: float
    priority_tag: str
    priority_label: str
    average_mastery: float | None = None
    primary_reason: str | None = None
    middle_categories: list[MiddleCategoryPriority] = []


class PrioritySummary(BaseModel):
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    on_track_count: int = 0
    strong_count: int = 0
    not_enough_data_count: int = 0
    needs_reassessment_count: int = 0


class CategoryPriorityHierarchy(BaseModel):
    certification_id: int
    summary: PrioritySummary
    major_categories: list[MajorCategoryPriority] = []


class ConfidenceResponse(BaseModel):
    learner_id: int
    certification_id: int
    confidence_score: float
    average_mastery: float
    mastered_count: int
    good_count: int
    developing_count: int
    weak_count: int
    total_lessons: int
    coverage_percentage: float
