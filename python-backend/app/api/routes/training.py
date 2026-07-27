from __future__ import annotations

from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_service_key
from app.db.models import BktModelRun
from app.db.session import get_db
from app.repositories.bkt import get_run, list_runs
from app.schemas.certification.training import (
    TrainingJobCreate,
    TrainingJobListResponse,
    TrainingJobResponse,
)
from app.services.training_service import create_training_run, set_task_id

router = APIRouter(
    prefix="/training",
    tags=["training"],
    dependencies=[Depends(require_service_key)],
)


def _dispatch(run: BktModelRun, db: Session, csv_path: str | None = None) -> None:
    from app.workers.tasks import train_bkt_model

    task = train_bkt_model.delay(run.model_run_id, csv_path)
    set_task_id(db, run.model_run_id, task.id)


@router.post("/jobs", response_model=TrainingJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_database_training_job(
    payload: TrainingJobCreate,
    db: Session = Depends(get_db),
) -> BktModelRun:
    run = create_training_run(
        db,
        source_type="database",
        requested_by=payload.requested_by,
        certification_id=payload.certification_id,
        date_from=payload.date_from,
        date_to=payload.date_to,
        seed=payload.seed,
        num_fits=payload.num_fits,
        test_size=payload.test_size,
        min_interactions_per_skill=payload.min_interactions_per_skill,
        min_learners_per_skill=payload.min_learners_per_skill,
    )
    _dispatch(run, db)
    db.refresh(run)
    return run


@router.post(
    "/jobs/from-csv",
    response_model=TrainingJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_csv_training_job(
    file: UploadFile = File(...),
    requested_by: str | None = Form(default=None),
    num_fits: int | None = Form(default=None, ge=1, le=20),
    seed: int | None = Form(default=None),
    test_size: float | None = Form(default=None, gt=0, lt=0.5),
    min_interactions_per_skill: int | None = Form(default=None, ge=1),
    min_learners_per_skill: int | None = Form(default=None, ge=1),
    db: Session = Depends(get_db),
) -> BktModelRun:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")

    settings = get_settings()
    run = create_training_run(
        db,
        source_type="csv",
        requested_by=requested_by,
        seed=seed,
        num_fits=num_fits,
        test_size=test_size,
        min_interactions_per_skill=min_interactions_per_skill,
        min_learners_per_skill=min_learners_per_skill,
    )
    run_dir = settings.artifact_dir / run.model_run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    upload_path = run_dir / "uploaded_training_data.csv"

    total = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with upload_path.open("wb") as destination:
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                destination.close()
                upload_path.unlink(missing_ok=True)
                run.status = "failed"
                run.error_message = f"CSV exceeds {settings.max_upload_mb} MB"
                db.commit()
                raise HTTPException(status_code=413, detail=run.error_message)
            destination.write(chunk)

    _dispatch(run, db, str(upload_path.resolve()))
    db.refresh(run)
    return run


@router.get("/jobs", response_model=TrainingJobListResponse)
def get_training_jobs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TrainingJobListResponse:
    items, total = list_runs(db, limit=limit, offset=offset)
    return TrainingJobListResponse(items=items, total=total)


@router.get("/jobs/{run_id}", response_model=TrainingJobResponse)
def get_training_job(run_id: str, db: Session = Depends(get_db)) -> BktModelRun:
    run = get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    return run


@router.post("/jobs/{run_id}/cancel", response_model=TrainingJobResponse)
def cancel_training_job(run_id: str, db: Session = Depends(get_db)) -> BktModelRun:
    run = get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    if run.status in {"succeeded", "failed", "cancelled"}:
        return run
    if run.celery_task_id:
        from app.workers.celery_app import celery_app

        celery_app.control.revoke(run.celery_task_id, terminate=False)
    run.status = "cancelled"
    db.commit()
    db.refresh(run)
    return run
