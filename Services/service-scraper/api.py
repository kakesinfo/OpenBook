from fastapi import FastAPI, HTTPException, Query, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel

from scheduler import scraper_manager
from scrapers import SCRAPERS
from database import db

app = FastAPI(
    title="Yet Another Library - Comics & BD Scraper Service",
    description="Microservice to scan comic publishers (Urban Comics, Panini Comics, Morgen BD, Mangetsu, Label 619) daily or on-demand",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SourceToggleRequest(BaseModel):
    enabled: bool

@app.get("/")
def root():
    return {
        "service": "Yet Another Library - Comics Scraper",
        "status": "online",
        "endpoints": {
            "health": "/api/health",
            "status": "/api/status",
            "sources": "GET /api/sources, PUT /api/sources/{source}",
            "trigger_all": "POST /api/scrape?full=false",
            "trigger_source": "POST /api/scrape/{source}?full=false",
            "repair_mojibake": "POST /api/repair",
            "recent_books": "/api/books"
        },
        "sources": list(SCRAPERS.keys())
    }

@app.get("/api/health")
def health():
    db_ok = db.check_connection()
    if not db_ok:
        raise HTTPException(status_code=503, detail="Database connection unavailable")
    return {
        "status": "healthy",
        "database": "connected",
        "scheduler_running": scraper_manager.scheduler.running
    }

@app.get("/api/status")
def status():
    return scraper_manager.get_status()

@app.get("/api/sources")
def get_sources():
    return {
        "sources": scraper_manager.get_sources()
    }

@app.put("/api/sources/{source}")
def update_source_status(
    source: str,
    body: Optional[SourceToggleRequest] = None,
    enabled: Optional[bool] = Query(None)
):
    if source not in SCRAPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Available: {list(SCRAPERS.keys())}"
        )
    is_enabled = body.enabled if body is not None else (enabled if enabled is not None else True)
    scraper_manager.set_source_enabled(source, is_enabled)
    return {
        "source": source,
        "enabled": is_enabled,
        "message": f"Source {source} {'activée' if is_enabled else 'désactivée'}."
    }

@app.post("/api/scrape")
def trigger_scrape(
    source: Optional[str] = Query(None, description="Optional scraper source: urban_comics, panini, etc. or comma-separated"),
    sources: Optional[str] = Query(None, description="Comma-separated list of sources"),
    full: bool = Query(False, description="Full catalog scan mode")
):
    selected_raw = sources or source
    source_list = None
    if selected_raw:
        parts = [s.strip() for s in selected_raw.split(",") if s.strip()]
        for p in parts:
            if p not in SCRAPERS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid source '{p}'. Available: {list(SCRAPERS.keys())}"
                )
        source_list = parts

    result = scraper_manager.trigger_scrape(source=None, full_scan=full, sources=source_list)
    return result

@app.post("/api/scrape/stop")
def stop_scrape():
    return scraper_manager.stop_scan()

@app.post("/api/scrape/{source}")
def trigger_scrape_source(
    source: str = Path(..., description="Scraper source: urban_comics, panini, morgen_bd, mangetsu, label619"),
    full: bool = Query(False, description="Full catalog scan mode")
):
    if source not in SCRAPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Available: {list(SCRAPERS.keys())}"
        )
    return scraper_manager.trigger_scrape(source, full_scan=full)

@app.post("/api/repair")
def repair_database():
    db.repair_mojibake()
    return {"status": "success", "message": "Mojibake character repair completed."}

@app.get("/api/books")
def get_books(limit: int = Query(20, ge=1, le=100)):
    return {
        "count": limit,
        "books": db.get_recent_books(limit=limit)
    }
