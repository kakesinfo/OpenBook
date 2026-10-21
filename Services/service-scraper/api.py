from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from scheduler import scraper_manager
from scrapers import SCRAPERS
from database import db

app = FastAPI(
    title="Yet Another Library - Comics & BD Scraper Service",
    description="Microservice to scan comic publishers (Urban Comics, Panini Comics, Morgen BD, Mangetsu, Label 619) daily or on-demand",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "service": "Yet Another Library - Comics Scraper",
        "status": "online",
        "endpoints": {
            "health": "/api/health",
            "status": "/api/status",
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

@app.post("/api/scrape")
def trigger_scrape(
    source: Optional[str] = Query(None, description="Optional scraper source: urban_comics, panini, morgen_bd, mangetsu, label619"),
    full: bool = Query(False, description="Full catalog scan mode")
):
    if source and source not in SCRAPERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Available: {list(SCRAPERS.keys())}"
        )
    result = scraper_manager.trigger_scrape(source, full_scan=full)
    return result

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
