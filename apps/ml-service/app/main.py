"""FastAPI entry point for KAVACH AI's internal analytics service."""

from __future__ import annotations

import importlib.util
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from .config import settings
from .database import database_health
from .legacy_compat import router as compatibility_router
from .routers import analytics_router
from .routers.ciap import router as ciap_router
from .services.common import PROTOTYPE_DISCLAIMER


def _allowed_origins() -> list[str]:
    configured = os.getenv("ML_SERVICE_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def _attach_legacy_routes(application: FastAPI) -> bool:
    """Append original generic-analytics routes without replacing KAVACH routes."""

    if os.getenv("KAVACH_INCLUDE_LEGACY_ML_ROUTES", "false").casefold() in {"0", "false", "no"}:
        return False
    legacy_path = Path(__file__).resolve().parents[1] / "app.py"
    if not legacy_path.exists():
        return False
    try:
        spec = importlib.util.spec_from_file_location("_kavach_legacy_ml_app", legacy_path)
        if spec is None or spec.loader is None:
            return False
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        legacy_app = getattr(module, "app", None)
        if not isinstance(legacy_app, FastAPI):
            return False
        protected_paths = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc", "/health"}
        application.router.routes.extend(route for route in legacy_app.router.routes if getattr(route, "path", None) not in protected_paths)
        return True
    except Exception:
        # Do not let unrelated PDF/acceleration dependencies make KAVACH unavailable.
        return False


def create_app() -> FastAPI:
    application = FastAPI(
        title="KAVACH AI Analytics Service",
        version="1.0.0",
        description="Internal, local-only, explainable crime-intelligence analytics. The Node backend is the public API boundary.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-Id"],
    )

    @application.middleware("http")
    async def enforce_request_size(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                oversized = int(content_length) > settings.maximum_request_bytes
            except ValueError:
                oversized = True
            if oversized:
                return JSONResponse(
                    status_code=413,
                    content={"status": "error", "code": "REQUEST_TOO_LARGE", "message": "Request body exceeds the configured limit."},
                )
        return await call_next(request)

    @application.exception_handler(Exception)
    async def unhandled_exception(_request: Request, _error: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "The analytics service could not process this request.",
                "disclaimer": PROTOTYPE_DISCLAIMER,
            },
        )

    @application.get("/health", tags=["health"])
    def health() -> dict[str, Any]:
        return {
            "success": True,
            "status": "healthy",
            "service": "kavach-analytics",
            "version": "1.0.0",
            "database": database_health(),
            "capabilities": ["ingestion", "hotspots", "anomalies", "forecast", "risk", "network", "mo_similarity", "explanations"],
            "disclaimer": PROTOTYPE_DISCLAIMER,
        }

    application.include_router(ciap_router)
    application.include_router(analytics_router)
    legacy_loaded = _attach_legacy_routes(application)
    if not legacy_loaded:
        application.include_router(compatibility_router)
    application.state.legacy_routes_loaded = legacy_loaded
    return application


app = create_app()
