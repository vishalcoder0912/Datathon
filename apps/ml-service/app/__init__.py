"""KAVACH AI analytics service package.

The package deliberately exposes ``app`` so both of these commands work:

``python -m uvicorn app:app --app-dir apps/ml-service``
``python -m uvicorn app.main:app --app-dir apps/ml-service``
"""

from .main import app, create_app

__all__ = ["app", "create_app"]
