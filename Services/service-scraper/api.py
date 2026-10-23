from fastapi import FastAPI, HTTPException, Query, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel

from scheduler import scraper_manager
from scrapers import SCRAPERS
from database import db

app = FastAPI(
    title="Yet Another Library - Comics & BD Scraper Service",
    description="Microservice to scan publishers (Urban Comics, Panini Comics, Morgen BD, Mangetsu, Label 619, Monsieur Toussaint Louverture) daily or on-demand",
    version="1.3.0"
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

class SplitSeriesRequest(BaseModel):
    source_series_id: int
    new_series_name: str
    book_ids: List[int]

class LinkVariantRequest(BaseModel):
    parent_book_id: int
    variant_book_ids: List[int]

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
            "deduplicate": "POST /api/deduplicate",
            "reconcile_variants": "POST /api/maintenance/reconcile-variants",
            "enrich_bnf": "POST /api/maintenance/enrich-bnf",
            "verify_isbn": "POST /api/maintenance/verify-isbn",
            "maintenance_stats": "GET /api/maintenance/stats",
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
    source: str = Path(..., description="Scraper source: urban_comics, panini, morgen_bd, mangetsu, label619, monsieur_toussaint_louverture"),
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
    res = db.repair_mojibake()
    msg = "Réparation UTF-8 terminée avec succès."
    if res:
        parts = []
        if res.get("repaired_books", 0) > 0:
            parts.append(f"{res['repaired_books']} tomes réparés")
        if res.get("repaired_series", 0) > 0:
            parts.append(f"{res['repaired_series']} séries réparées")
        if res.get("merged_duplicates", 0) > 0:
            parts.append(f"{res['merged_duplicates']} doublons fusionnés")
        if parts:
            msg = f"Réparation UTF-8 terminée : {', '.join(parts)}."
        else:
            msg = "Vérification UTF-8 terminée : aucun texte corrompu détecté."
    return {"status": "success", "message": msg, "details": res}

@app.post("/api/deduplicate")
def deduplicate_database():
    merged = db.deduplicate_books()
    if merged > 0:
        msg = f"Dédouplication terminée : {merged} tome(s) doublon(s) fusionné(s) et nettoyé(s)."
    else:
        msg = "Aucun tome en double détecté. La base de données est parfaitement propre !"
    return {"status": "success", "merged_count": merged, "message": msg}

@app.get("/api/maintenance/stats")
def maintenance_stats():
    return {
        "status": "success",
        "stats": db.get_maintenance_stats()
    }

@app.get("/api/maintenance/conflicts")
def get_volume_conflicts():
    conflicts = db.detect_volume_conflicts()
    return {"status": "success", "count": len(conflicts), "conflicts": conflicts}

@app.post("/api/maintenance/split")
def split_series_endpoint(req: SplitSeriesRequest):
    try:
        res = db.split_series(req.source_series_id, req.new_series_name, req.book_ids)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/maintenance/link-variant")
def link_variant_endpoint(req: LinkVariantRequest):
    try:
        res = db.link_as_variant(req.parent_book_id, req.variant_book_ids)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/maintenance/reconcile-variants")
def reconcile_variants_endpoint():
    try:
        res = db.reconcile_variants()
        return {
            "status": "success",
            "message": "Réconciliation des variantes effectuée avec succès.",
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/maintenance/enrich-bnf")
@app.post("/api/enrich-bnf")
def enrich_bnf_endpoint(limit: int = Query(50, ge=1, le=500)):
    try:
        res = db.enrich_books_from_bnf(limit=limit)
        enriched = res.get("enriched", 0)
        scanned = res.get("scanned", 0)
        if enriched > 0:
            msg = f"Enrichissement BNF terminé : {enriched} album(s) enrichi(s) sur {scanned} analysé(s)."
        elif scanned > 0:
            msg = f"Enrichissement BNF terminé : {scanned} album(s) analysé(s), aucune correspondance BNF trouvée."
        else:
            msg = "Tous les albums possèdent déjà un ISBN valide !"
        return {
            "status": "success",
            "message": msg,
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/maintenance/verify-isbn")
@app.post("/api/verify-isbn")
def verify_isbn_endpoint(limit: int = Query(50, ge=1, le=500), force: bool = Query(True)):
    try:
        res = db.verify_books_from_bnf(limit=limit, force_update_pages=force)
        scanned = res.get("scanned", 0)
        verified = res.get("verified_in_bnf", 0)
        updated = res.get("updated_count", 0)
        pages = res.get("pages_corrected", 0)
        collections = res.get("collections_added", 0)
        authors = res.get("authors_added", 0)

        parts = []
        if pages > 0:
            parts.append(f"{pages} page(s) corrigée(s)")
        if collections > 0:
            parts.append(f"{collections} collection(s) rattachée(s)")
        if authors > 0:
            parts.append(f"{authors} auteur(s) associé(s)")

        if updated > 0:
            msg = f"Vérification BnF terminée : {updated} album(s) mis à jour ({', '.join(parts)}) sur {scanned} analysé(s)."
        elif scanned > 0:
            msg = f"Vérification BnF terminée : {scanned} album(s) analysé(s) ({verified} trouvés à la BnF), toutes les métadonnées sont déjà exactes !"
        else:
            msg = "Aucun album à vérifier."
        return {
            "status": "success",
            "message": msg,
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/books")
def get_books(limit: int = Query(20, ge=1, le=100)) :
    return {
        "count": limit,
        "books": db.get_recent_books(limit=limit)
    }
