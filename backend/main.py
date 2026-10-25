import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database import init_database, get_db_status
from backend.routers import (
    auth,
    hospitals,
    donors,
    recipients,
    organs,
    matching,
    allocations,
    audit,
    reviews,
    acid,
    reports
)

logger = logging.getLogger("vital.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB connection
    logger.info("Starting VITAL Backend Application...")
    init_database()
    yield
    # Shutdown
    logger.info("Shutting down VITAL Backend Application...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
    ## VITAL — Vital Information Transplant Allocation & Logistics
    **A Real-Time, ACID-Compliant Database System for Kidney Matching**
    
    * **Strict Scope:** Kidney Transplantation Only.
    * **Database Engine:** Oracle Database XE / 19c / 21c / 23c with PL/SQL Stored Procedures, Functions, Cursors, and Triggers.
    * **Academic Rubrics:** Fully implements Review 1 (Basic SQL & Modeling), Review 2 (Advanced SQL & PL/SQL), and Comprehensive Project Report.
    """,
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith(".jsx") or path.endswith(".html") or path.endswith(".js") or path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# Include Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(hospitals.router, prefix=settings.API_PREFIX)
app.include_router(donors.router, prefix=settings.API_PREFIX)
app.include_router(recipients.router, prefix=settings.API_PREFIX)
app.include_router(organs.router, prefix=settings.API_PREFIX)
app.include_router(matching.router, prefix=settings.API_PREFIX)
app.include_router(allocations.router, prefix=settings.API_PREFIX)
app.include_router(audit.router, prefix=settings.API_PREFIX)
app.include_router(reviews.router, prefix=settings.API_PREFIX)
app.include_router(acid.router, prefix=settings.API_PREFIX)
app.include_router(reports.router, prefix=settings.API_PREFIX)

@app.get("/api/health", tags=["Health & Diagnostics"])
def health_check():
    """
    Returns real-time system health, Oracle database connectivity status,
    active driver details, and live entity counts.
    """
    db_status = get_db_status()
    return {
        "status": "ONLINE",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status
    }

# Mount Frontend SPA
import os
from fastapi.staticfiles import StaticFiles
frontend_public = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public")
if os.path.exists(frontend_public):
    app.mount("/", StaticFiles(directory=frontend_public, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
