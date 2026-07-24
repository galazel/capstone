from fastapi import APIRouter
from app.api.v1 import certification, assessment, tutor

api_router = APIRouter(prefix="/api")

api_router.include_router(
    certification.router,
    prefix="/certification",
    tags=["Certification"]
)

api_router.include_router(
    assessment.router,
    prefix="/lesson",
    tags=["Lesson"]
)

api_router.include_router(
    tutor.router,
    prefix="/tutor",
    tags=["Tutor"]
)

