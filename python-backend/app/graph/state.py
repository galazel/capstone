from typing import TypedDict, List, Dict, Optional, Annotated
from operator import add


class CertificationState(TypedDict):
    certification_name: str
    certification_description: str
    industry: str

    profile_bytes: bytes
    uploaded_files: List[Dict]

    curriculum: Dict

    lessons: Annotated[List[Dict], add]
    questions: Annotated[List[Dict], add]

    extracted_text: str
    vector_store_id: str

    status: str
    error_message: Optional[str]