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
        self.disabled_sources: set = self._load_disabled_sources()

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

            if sources:
                target_desc = ", ".join(sources)
            elif source:
                target_desc = source
            else:
                target_desc = "all active"

            self.current_job = f"{target_desc}{' (full)' if full_scan else ''}"
            self.last_status = "running"

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

        logger.info("Starting scrape process for sources: %s (full_scan=%s)", sources_to_run, full_scan)

        try:
            for s_name in sources_to_run:
                try:
                    logger.info("Running scraper: %s", s_name)
                    scraper = get_scraper(s_name)
                    limit = 2000 if full_scan else settings.MAX_BOOKS_PER_SOURCE
                    books = scraper.scrape(max_items=limit, full_scan=full_scan)

                    saved_count = 0
                    for b in books:
                        book_id = db.upsert_book(b)
                        if book_id:
                            saved_count += 1

                    summary["results"][s_name] = {
                        "scraped": len(books),
                        "saved": saved_count,
                        "status": "success"
                    }
                    summary["total_scraped"] += len(books)
                    summary["total_saved"] += saved_count
                    logger.info("Scraper %s finished: %d scraped, %d saved/updated", s_name, len(books), saved_count)

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

            summary["end_time"] = datetime.now().isoformat()
            summary["status"] = "success" if not summary["errors"] else "completed_with_errors"

        finally:
            with self._lock:
                self.is_running = False
                self.current_job = None
                self.last_run = datetime.now()
                self.last_status = summary["status"]
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
            "recent_history": self.history[:5]
        }

scraper_manager = ScraperManager()
