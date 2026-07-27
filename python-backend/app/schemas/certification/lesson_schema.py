from typing import List

from pydantic import BaseModel, Field, model_validator

# Shorter than this and the field is a stub the model gave up on, not content.
MIN_INTRODUCTION_CHARS = 40
MIN_SUMMARY_CHARS = 40


class KeyTerm(BaseModel):
    term: str
    definition: str


class GeneratedLesson(BaseModel):
    """One authored lesson, with the anatomy every REBYU lesson must have.

    This was previously just `sections: List[dict]` -- an untyped bag of UI
    blocks. The agent's prompt asked for a 14-part structure, but nothing
    enforced it, so a lesson missing its introduction, objectives, or summary
    reached an admin silently. Same failure mode the question rules had
    before they moved out of the prompt and into the model.

    Categories have no equivalent by design: they are organizational
    (title + assessment) and carry no instructional content.

    `sections` is still the tool-built block list for the *main instructional
    content*; the surrounding anatomy is explicit so it can be validated and
    rendered consistently across every lesson.
    """

    title: str
    introduction: str
    learning_objectives: List[str] = Field(default_factory=list)
    estimated_minutes: int = 15
    #: Main instructional content as display blocks, exactly as the
    #: lesson-builder tools returned them.
    sections: List[dict] = Field(default_factory=list)
    key_terms: List[KeyTerm] = Field(default_factory=list)
    summary: str = ""

    @model_validator(mode="after")
    def _enforce_lesson_anatomy(self) -> "GeneratedLesson":
        if not self.title.strip():
            raise ValueError("lesson must have a title")
        if len(self.introduction.strip()) < MIN_INTRODUCTION_CHARS:
            raise ValueError(
                f"lesson introduction must be at least {MIN_INTRODUCTION_CHARS} characters"
            )
        if not self.learning_objectives:
            raise ValueError("lesson must declare at least one learning objective")
        if any(not objective.strip() for objective in self.learning_objectives):
            raise ValueError("learning objectives must not be blank")
        if self.estimated_minutes <= 0:
            raise ValueError("estimated_minutes must be positive")
        if not self.sections:
            raise ValueError("lesson must contain instructional content")
        if len(self.summary.strip()) < MIN_SUMMARY_CHARS:
            raise ValueError(f"lesson summary must be at least {MIN_SUMMARY_CHARS} characters")
        return self


class GeneratedLessonSections(BaseModel):
    """Legacy shape, kept only so checkpoints created before the typed
    schema still deserialize. New runs return `GeneratedLesson`."""

    sections: List[dict]
