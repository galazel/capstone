from pydantic import BaseModel

class AuditorResult(BaseModel):
    is_related: bool
    reason: str