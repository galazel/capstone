from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_service_key
from app.db.session import get_db
from app.schemas.certification.analytics import ReadinessRequest, ReadinessResponse
from app.services.readiness_service import calculate_readiness

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_service_key)],
)


@router.post("/readiness", response_model=ReadinessResponse)
def readiness(payload: ReadinessRequest, db: Session = Depends(get_db)):
    return calculate_readiness(db, payload)
