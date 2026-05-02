"""AWS Lambda entry point. Wraps the FastAPI app with mangum."""

from __future__ import annotations

from mangum import Mangum

from app.main import app

handler = Mangum(app, lifespan="off")
