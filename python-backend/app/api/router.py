from fastapi import APIRouter

from app.api.routes import analytics, health, mastery, parameters, priorities, training
from app.core.config import get_settings

settings = get_settings()
api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(health.router)
api_router.include_router(training.router)
api_router.include_router(mastery.router)
api_router.include_router(parameters.router)
api_router.include_router(analytics.router)
api_router.include_router(priorities.router)
