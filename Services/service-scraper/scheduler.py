import logging
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from database import db
from scrapers import SCRAPERS, get_scraper

logger = logging.getLogger(__name__)

class ScraperManager:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False
        self.current_job: Optional[str] = None
        self.last_run: Optional[datetime] = None
        self.last_status: str = "idle"
        self.history: List[Dict[str, Any]] = []
        self._lock = threading.Lock()

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

    def trigger_scrape(self, source: Optional[str] = None, full_scan: bool = False) -> Dict[str, Any]:
        """Trigger an on-demand scrape asynchronously in a background thread."""
        with self._lock:
            if self.is_running:
                return {
                    "status": "already_running",
                    "current_job": self.current_job,
                    "message": "A scraping job is already in progress."
                }
            self.is_running = True
            self.current_job = f"{source or 'all'}{' (full)' if full_scan else ''}"
            self.last_status = "running"

        thread = threading.Thread(
            target=self._execute_scrape,
            args=(source, full_scan),
            daemon=True
        )
        thread.start()

        mode_str = "full catalog scan" if full_scan else "standard scan"
        return {
            "status": "started",
            "source": source or "all",
            "full_scan": full_scan,
            "message": f"Scraping job started for {source or 'all sources'} ({mode_str})."
        }

    def run_full_scrape(self):
        """Called by the daily scheduler."""
        logger.info("Executing scheduled daily scrape")
        self._execute_scrape(source=None, full_scan=False)

    def _execute_scrape(self, source: Optional[str] = None, full_scan: bool = False):
        start_time = datetime.now()
        sources_to_run = [source] if source and source in SCRAPERS else list(SCRAPERS.keys())
        
        # 1. Clean existing mojibake
        try:
            db.repair_mojibake()
        except Exception as e:
            logger.warning("Error running mojibake repair: %s", e)

        summary = {
            "start_time": start_time.isoformat(),
            "source": source or "all",
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
            "available_sources": list(SCRAPERS.keys()),
            "schedule": {
                "daily_at": f"{settings.SCHEDULE_HOUR:02d}:{settings.SCHEDULE_MINUTE:02d}",
                "scrape_on_startup": settings.SCRAPE_ON_STARTUP
            },
            "recent_history": self.history[:5]
        }

scraper_manager = ScraperManager()
