from typing import Annotated
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Depends,
    APIRouter
)
from pydantic import BaseModel
import traceback
from app.graphs.workflow import certification_graph
from app.database.session import get_db
from sqlalchemy.orm import Session

app = FastAPI(title="REBYU Certification API")
router = APIRouter()

ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
]


class GenerateCertificationRequest(BaseModel):
    certification_name: str
    certification_description: str
    industry: str

    @classmethod
    def as_form(
        cls,
        certification_name: str = Form(...),
        certification_description: str = Form(...),
        industry: str = Form(...),
    ):
        return cls(
            certification_name=certification_name,
            certification_description=certification_description,
            industry=industry,
        )

@router.get("/")
async def get_certifications(db: Session = Depends(get_db)):
    return {
        "message": "Database connection successful"
    }

@router.post("/generate-certification")
async def generate_certification(
    request: Annotated[
        GenerateCertificationRequest,
        Depends(GenerateCertificationRequest.as_form)
    ],
    profile: UploadFile = File(...),
    files: list[UploadFile] = File(...)
):

    if profile.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Profile image must be JPEG, PNG, or WEBP. Received: {profile.content_type}"
        )

    profile_bytes = await profile.read()
    uploaded_documents = []

    for file in files:
        if file.content_type not in ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"{file.filename} must be PDF or DOCX."
            )

        content = await file.read()
        uploaded_documents.append({
            "filename": file.filename,
            "type": file.content_type,
            "size": len(content),
            "content": content
        })

    try:
        result = await certification_graph.ainvoke({
            "certification_name": request.certification_name,
            "certification_description": request.certification_description,
            "industry": request.industry,
            "profile_bytes": profile_bytes,
            "uploaded_files": uploaded_documents,
            "curriculum": [],
            "lessons": [],
            "questions": [],
            "status": "STARTED"
        })

        # --- ADD THIS CHECK ---
        if result.get("status") == "VALIDATION_FAILED":
            raise HTTPException(
                status_code=400,
                detail=result.get("error_message", "Uploaded documents do not match the certification topics.")
            )

    except HTTPException:
        # Re-raise HTTPExceptions so FastAPI handles them correctly
        raise
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {
        "certification_name": result.get("certification_name"),
        "curriculum": result.get("curriculum", []),
        "status": result.get("status")
    }

