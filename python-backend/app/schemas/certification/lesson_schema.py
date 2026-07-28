from typing import Any, List

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.helpers import create_id

# Shorter than this and the field is a stub the model gave up on, not content.
MIN_INTRODUCTION_CHARS = 40
MIN_SUMMARY_CHARS = 40

#: The keys under `data` that hold lists of renderable items. Each entry needs
#: a stable `id` for React keys and for editing a single item later.
ITEM_COLLECTIONS = ("items", "cards", "gridItems")

#: Blocks whose renderer reads `file` (an admin-uploaded asset that overrides
#: the searched URL). Absent from model output, present in every stored block.
MEDIA_KEYS = ("imageKey", "videoKey")


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

    @field_validator("sections", mode="before")
    @classmethod
    def _normalise_blocks(cls, value: Any) -> Any:
        """Fills in the bookkeeping the builder tools used to add.

        Those tools were pure shape constructors -- no side effects, no
        external calls -- so their only real contribution was `create_id()` on
        list items and a `file: None` slot. Requiring the model to call
        eighteen of them and then repeat each result verbatim into `sections`
        bought nothing and broke reliably: it tried to inline
        `<function=add_lesson_heading>{...}</function>` *inside* the sections
        array, which the provider rejects outright.

        Generating the ids here is also strictly better than the tools were --
        a model cannot forget to do it.
        """
        if not isinstance(value, list):
            return value

        blocks = []
        for block in value:
            if not isinstance(block, dict):
                blocks.append(block)
                continue

            data = block.get("data")
            if isinstance(data, dict):
                data = dict(data)
                for key in ITEM_COLLECTIONS:
                    entries = data.get(key)
                    if isinstance(entries, list):
                        data[key] = [
                            {"id": create_id(), **entry} if isinstance(entry, dict) else entry
                            for entry in entries
                        ]
                if any(media in data for media in MEDIA_KEYS):
                    data.setdefault("file", None)
                block = {**block, "data": data}

            blocks.append(block)
        return blocks

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
