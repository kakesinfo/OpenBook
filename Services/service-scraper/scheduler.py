import logging
import threading
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from database import db
from scrapers import SCRAPERS, get_scraper
from scrapers.base import ScrapedBook

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "sources_config.json")

class ScraperManager:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False
        self.current_job: Optional[str] = None
        self.last_run: Optional[datetime] = None
        self.last_status: str = "idle"
        self.history: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self.disabled_sources: set = self._load_disabled_sources()
        self.live_scan: Dict[str, Any] = {
            "is_running": False,
            "job_name": None,
            "current_source": None,
            "current_source_name": None,
            "current_source_color": None,
            "total_found": 0,
            "total_saved": 0,
            "recent_books": [],
            "started_at": None,
            "ended_at": None,
            "last_error": None,
        }
        self._init_recent_books_from_db()

    def _init_recent_books_from_db(self):
        try:
            db_books = db.get_recent_books(limit=10)
            if db_books:
                for b in db_books:
                    self.live_scan["recent_books"].append({
                        "id": b.get("id"),
                        "title": b.get("title"),
                        "series_name": b.get("series_name"),
                        "volume": b.get("volume"),
                        "isbn": b.get("isbn"),
                        "editor_name": b.get("editor_name"),
                        "cover_url": b.get("cover_url"),
                        "price": b.get("price"),
                        "authors": [],
                        "source_id": None,
                        "source_name": b.get("editor_name") or "Catalogue",
                        "source_color": "#6366f1",
                        "found_at": None
                    })
                self.live_scan["total_found"] = len(self.live_scan["recent_books"])
        except Exception as e:
            logger.debug("Could not prefill recent books from DB: %s", e)

    def _load_disabled_sources(self) -> set:
        try:
            if os.path.exists(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return set(data.get("disabled_sources", []))
        except Exception as e:
            logger.warning("Could not load sources_config.json: %s", e)
        return set()

    def _save_disabled_sources(self):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"disabled_sources": list(self.disabled_sources)}, f, indent=2)
        except Exception as e:
            logger.warning("Could not save sources_config.json: %s", e)

    def set_source_enabled(self, source: str, enabled: bool):
        with self._lock:
            if enabled:
                self.disabled_sources.discard(source)
            else:
                self.disabled_sources.add(source)
            self._save_disabled_sources()
        logger.info("Source '%s' status changed: enabled=%s", source, enabled)

    def is_source_enabled(self, source: str) -> bool:
        return source not in self.disabled_sources

    def get_sources(self) -> List[Dict[str, Any]]:
        result = []
        for s_name, scraper_cls in SCRAPERS.items():
            scraper = scraper_cls()
            result.append({
                "id": scraper.name,
                "name": scraper.display_name,
                "desc": scraper.description,
                "color": scraper.color,
                "enabled": scraper.name not in self.disabled_sources
            })
        return result

    def start_scheduler(self):
        trigger = CronTrigger(
            hour=settings.SCHEDULE_HOUR,
            minute=settings.SCHEDULE_MINUTE
        )
        self.scheduler.add_job(
            self.run_full_scrape,
            trigger=trigger,
            id="daily_scrape",
            name="Daily Comic & BD Scrape",
            replace_existing=True
        )
        self.scheduler.start()
        logger.info(
            "Scheduler started: Daily scrape configured at %02d:%02d",
            settings.SCHEDULE_HOUR,
            settings.SCHEDULE_MINUTE
        )

    def stop_scan(self) -> Dict[str, Any]:
        with self._lock:
            if not self.is_running:
                return {
                    "status": "not_running",
                    "message": "Aucun scan n'est actuellement en cours."
                }
            self._stop_event.set()
            return {
                "status": "stopping",
                "message": "Arrêt du scan demandé."
            }

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def trigger_scrape(
        self,
        source: Optional[str] = None,
        full_scan: bool = False,
        sources: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Trigger an on-demand scrape asynchronously in a background thread."""
        with self._lock:
            if self.is_running:
                return {
                    "status": "already_running",
                    "current_job": self.current_job,
                    "message": "A scraping job is already in progress."
                }
            self.is_running = True
            self._stop_event.clear()

            if sources:
                target_desc = ", ".join(sources)
                first_src = sources[0]
            elif source:
                target_desc = source
                first_src = source.split(",")[0].strip()
            else:
                target_desc = "all active"
                active_list = [s for s in SCRAPERS.keys() if s not in self.disabled_sources]
                first_src = active_list[0] if active_list else None

            self.current_job = f"{target_desc}{' (full)' if full_scan else ''}"
            self.last_status = "running"

            first_scr = get_scraper(first_src) if (first_src and first_src in SCRAPERS) else None
            self.live_scan = {
                "is_running": True,
                "job_name": target_desc,
                "current_source": first_src,
                "current_source_name": first_scr.display_name if first_scr else target_desc,
                "current_source_color": first_scr.color if first_scr else "#6366f1",
                "total_found": 0,
                "total_saved": 0,
                "recent_books": [],
                "started_at": datetime.now().isoformat(),
                "ended_at": None,
            }

        thread = threading.Thread(
            target=self._execute_scrape,
            args=(source, full_scan, sources),
            daemon=True
        )
        thread.start()

        mode_str = "full catalog scan" if full_scan else "standard scan"
        return {
            "status": "started",
            "source": target_desc,
            "full_scan": full_scan,
            "message": f"Scraping job started for {target_desc} ({mode_str})."
        }

    def run_full_scrape(self):
        """Called by the daily scheduler: only scrapes enabled sources."""
        logger.info("Executing scheduled daily scrape")
        self._execute_scrape(source=None, full_scan=False, sources=None)

    def _execute_scrape(
        self,
        source: Optional[str] = None,
        full_scan: bool = False,
        sources: Optional[List[str]] = None
    ):
        start_time = datetime.now()

        if sources:
            sources_to_run = [s for s in sources if s in SCRAPERS]
        elif source:
            sources_to_run = [s.strip() for s in source.split(",") if s.strip() in SCRAPERS]
        else:
            # Run all active/enabled sources
            sources_to_run = [s for s in SCRAPERS.keys() if s not in self.disabled_sources]

        # 1. Clean existing mojibake
        try:
            db.repair_mojibake()
        except Exception as e:
            logger.warning("Error running mojibake repair: %s", e)

        summary = {
            "start_time": start_time.isoformat(),
            "source": ", ".join(sources_to_run) if sources_to_run else (source or "none"),
            "full_scan": full_scan,
            "results": {},
            "total_scraped": 0,
            "total_saved": 0,
            "errors": []
        }

        with self._lock:
            first_s = sources_to_run[0] if sources_to_run else None
            first_scraper = get_scraper(first_s) if (first_s and first_s in SCRAPERS) else None
            self.live_scan["is_running"] = True
            self.live_scan["job_name"] = ", ".join(sources_to_run) if sources_to_run else (source or "none")
            self.live_scan["current_source"] = first_s
            self.live_scan["current_source_name"] = first_scraper.display_name if first_scraper else first_s
            self.live_scan["current_source_color"] = first_scraper.color if first_scraper else "#6366f1"
            self.live_scan["total_found"] = 0
            self.live_scan["total_saved"] = 0
            self.live_scan["recent_books"] = []
            self.live_scan["started_at"] = start_time.isoformat()
            self.live_scan["ended_at"] = None
            self.live_scan["last_error"] = None

        logger.info("Starting scrape process for sources: %s (full_scan=%s)", sources_to_run, full_scan)

        try:
            for s_name in sources_to_run:
                if self._stop_event.is_set():
                    logger.info("Scrape halted early by user request before running %s", s_name)
                    summary["status"] = "cancelled"
                    break
                try:
                    logger.info("Running scraper: %s", s_name)
                    scraper = get_scraper(s_name)
                    with self._lock:
                        self.live_scan["current_source"] = s_name
                        self.live_scan["current_source_name"] = scraper.display_name
                        self.live_scan["current_source_color"] = scraper.color

                    limit = 50000 if full_scan else settings.MAX_BOOKS_PER_SOURCE
                    saved_this_source = [0]
                    seen_in_callback = set()

                    def on_book_found(b: ScrapedBook):
                        if self._stop_event.is_set():
                            return
                        book_id = db.upsert_book(b)
                        is_saved = bool(book_id)
                        ident = b.isbn or b.title
                        if is_saved and ident not in seen_in_callback:
                            seen_in_callback.add(ident)
                            saved_this_source[0] += 1

                        with self._lock:
                            self.live_scan["total_found"] += 1
                            if is_saved:
                                self.live_scan["total_saved"] += 1

                            book_item = {
                                "id": book_id,
                                "title": b.title,
                                "series_name": b.series_name,
                                "volume": b.volume,
                                "isbn": b.isbn,
                                "editor_name": b.editor_name or scraper.display_name,
                                "cover_url": b.cover_url,
                                "price": b.price,
                                "page_count": b.page_count,
                                "authors": [f"{a.firstname} {a.lastname}".strip() for a in b.authors if a.lastname],
                                "source_id": s_name,
                                "source_name": scraper.display_name,
                                "source_color": scraper.color,
                                "found_at": datetime.now().strftime("%H:%M:%S")
                            }
                            self.live_scan["recent_books"].insert(0, book_item)
                            if len(self.live_scan["recent_books"]) > 10:
                                self.live_scan["recent_books"] = self.live_scan["recent_books"][:10]

                    books = scraper.scrape(
                        max_items=limit,
                        full_scan=full_scan,
                        on_book_found=on_book_found,
                        is_stopped=self._stop_event.is_set
                    )

                    if self._stop_event.is_set():
                        logger.info("Scraper %s stopped early by user request", s_name)
                        summary["results"][s_name] = {
                            "scraped": len(books),
                            "saved": saved_this_source[0],
                            "status": "cancelled"
                        }
                        summary["status"] = "cancelled"
                        break

                    # Safeguard: in case any book was not captured via callback
                    for b in books:
                        ident = b.isbn or b.title
                        if ident not in seen_in_callback:
                            on_book_found(b)

                    summary["results"][s_name] = {
                        "scraped": len(books),
                        "saved": saved_this_source[0],
                        "status": "success"
                    }
                    summary["total_scraped"] += len(books)
                    summary["total_saved"] += saved_this_source[0]
                    logger.info("Scraper %s finished: %d scraped, %d saved/updated", s_name, len(books), saved_this_source[0])

                except Exception as e:
                    err_msg = f"Error in scraper {s_name}: {str(e)}"
                    logger.error(err_msg, exc_info=True)
                    summary["errors"].append(err_msg)
                    summary["results"][s_name] = {
                        "scraped": 0,
                        "saved": 0,
                        "status": "error",
                        "error": str(e)
                    }
                    with self._lock:
                        self.live_scan["last_error"] = str(e)

            # Post-scan: reconcile and couple variants across all additions
            try:
                logger.info("Executing post-scan variant coupling pass...")
                rec_res = db.reconcile_variants()
                summary["variant_reconciliation"] = rec_res
                logger.info("Variant coupling pass completed: %s", rec_res)
            except Exception as e:
                logger.warning("Error during post-scan variant coupling pass: %s", e)

            summary["end_time"] = datetime.now().isoformat()
            summary["status"] = "success" if not summary["errors"] else "completed_with_errors"

        finally:
            with self._lock:
                self.is_running = False
                self.current_job = None
                self.last_run = datetime.now()
                self.last_status = summary["status"]
                self.live_scan["is_running"] = False
                self.live_scan["current_source"] = None
                self.live_scan["ended_at"] = datetime.now().isoformat()
                self.history.insert(0, summary)
                if len(self.history) > 20:
                    self.history.pop()

        logger.info(
            "Scrape process ended: %d scraped, %d saved in %s",
            summary["total_scraped"],
            summary["total_saved"],
            summary["status"]
        )

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "current_job": self.current_job,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "last_status": self.last_status,
            "sources": self.get_sources(),
            "available_sources": list(SCRAPERS.keys()),
            "disabled_sources": list(self.disabled_sources),
            "enabled_sources": [s for s in SCRAPERS.keys() if s not in self.disabled_sources],
            "schedule": {
                "daily_at": f"{settings.SCHEDULE_HOUR:02d}:{settings.SCHEDULE_MINUTE:02d}",
                "scrape_on_startup": settings.SCRAPE_ON_STARTUP
            },
            "recent_history": self.history[:5],
            "live_scan": self.live_scan
        }

scraper_manager = ScraperManager()
