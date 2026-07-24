from pydantic import BaseModel
class LessonAuditResult(BaseModel):
    passed: bool
    regenerate: bool
    summary: str
    missing_topics: list[str]
    failed_lessons: list[str]