"""
SatQuery AI - Production Backend Application Entrypoint
Target Problem Statement: SIH26167 (ISRO / Space Applications Centre)

Security hardening (Agent A):
  - CORS restricted to configured FRONTEND_URL (A-4)
  - API key auth on protected routers (A-5)
  - CSP + security headers middleware (A-8)
  - Swagger docs disabled in production (A-10)
  - Structured logging (B-9)
  - SQLite lifespan init (B-7)
  - Real async health check with dependency probes (B-10)
"""

import os
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .logging_config import setup_logging
from .database import init_db
from .middleware.auth import verify_api_key
from .api.routes_query import router as query_router
from .api.routes_samples import router as samples_router
from .api.routes_stac import router as stac_router
from .api.routes_upload import router as upload_router
from .api.routes_benchmark import router as benchmark_router

# Configure logging first
setup_logging()
logger = logging.getLogger(__name__)

ENV = os.getenv("SATQUERY_ENV", "development")


# ── CSP & Security Headers Middleware (A-8) ────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' https://*.arcgis.com https://server.arcgisonline.com data: blob:; "
            "connect-src 'self' http://localhost:8080 http://localhost:11434; "
            "worker-src 'self' blob:;"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


# ── Application Lifespan (B-7) ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("SatQuery AI starting up — env=%s", ENV)
    init_db()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Upload dir ready: %s", settings.upload_dir)
    yield
    # Shutdown
    logger.info("SatQuery AI shutting down")


# ── FastAPI App (A-10: no docs in production) ──────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=settings.description,
    docs_url="/docs" if ENV != "production" else None,
    redoc_url="/redoc" if ENV != "production" else None,
    lifespan=lifespan,
)

# ── CORS Middleware (A-4) ──────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list(dict.fromkeys([
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ── Security Headers (A-8) ────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── Apply auth to protected routers (A-5) ─────────────────────────────────────
# Samples and STAC are open (no auth needed for read-only public data)
query_router.dependencies.append(verify_api_key)  # type: ignore[arg-type]
upload_router.dependencies.append(verify_api_key)  # type: ignore[arg-type]
benchmark_router.dependencies.append(verify_api_key)  # type: ignore[arg-type]

# ── Register Routers ──────────────────────────────────────────────────────────
app.include_router(query_router)
app.include_router(samples_router)
app.include_router(stac_router)
app.include_router(upload_router)
app.include_router(benchmark_router)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/")
def root_status():
    return {
        "app": settings.app_name,
        "version": settings.version,
        "status": "operational",
        "theme": "Space Technology (SIH26167 - ISRO / SAC)",
        "endpoints": {
            "health": "/api/health",
            "query": "/api/query",
            "samples": "/api/samples/manifest",
            "stac_search": "/api/stac/search",
        },
    }


# ── Real Health Check (B-10) ──────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    """Health check with real dependency probes."""
    checks: dict = {}

    # Upload dir writable
    try:
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        checks["upload_dir"] = "ok"
    except Exception:
        checks["upload_dir"] = "error"

    # Ollama reachable
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            checks["ollama"] = "ok" if resp.status_code == 200 else "unreachable"
    except Exception:
        checks["ollama"] = "unreachable"

    # STAC element84 reachable
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.stac_element84_url.replace("/search", "/"))
            checks["stac_element84"] = "ok" if resp.status_code == 200 else "unreachable"
    except Exception:
        checks["stac_element84"] = "unreachable"

    overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
    bhuvan_configured = bool(settings.bhuvan_api_key.strip())
    mosdac_configured = bool(settings.mosdac_username.strip() and settings.mosdac_password.strip())
    live_stac = "online" if checks.get("stac_element84") == "ok" else "standby"

    return {
        "status": overall,
        "checks": checks,
        "live_stac_streaming": live_stac,
        "integrations": {
            "bhuvan_wms": {
                "configured": bhuvan_configured,
                "status": "configured" if bhuvan_configured else "not_configured",
                "details": "BHUVAN_API_KEY present in backend/.env" if bhuvan_configured else "Requires BHUVAN_API_KEY in backend/.env",
            },
            "mosdac": {
                "configured": mosdac_configured,
                "status": "configured" if mosdac_configured else "not_configured",
                "details": "MOSDAC credentials configured" if mosdac_configured else "Requires MOSDAC credentials in backend/.env",
            },
        },
        "version": settings.version,
        "environment": ENV,
        "sample_data_ready": (settings.sample_dir / "sample_manifest.json").exists(),
        "supported_sensors": [
            "Sentinel-2 MSI (Multispectral Optical)",
            "Sentinel-1 C-SAR (Synthetic Aperture Radar)",
            "Cartosat-2S / 3 (Sub-meter Optical)",
            "RISAT-1A / EOS-04 (C-band Hybrid Polarimetric SAR)",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port, reload=True)
