import sys
import argparse
import logging
import uvicorn

from config import settings
from scheduler import scraper_manager
from database import db
from api import app

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("scraper-service")

def parse_args():
    parser = argparse.ArgumentParser(description="Comics & BD Scraper Service")
    parser.add_argument(
        "--now",
        action="store_true",
        help="Run scraping immediately and exit (CLI mode)"
    )
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Specific source to scrape (urban_comics, panini, morgen_bd, mangetsu, label619, monsieur_toussaint_louverture)"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Crawl full catalog across all pages"
    )
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Run database UTF-8 mojibake repair and variant reconciliation and exit"
    )
    return parser.parse_args()

def run_cli(source=None, full_scan=False):
    logger.info("Running scraper in CLI mode (immediate execution, full_scan=%s)...", full_scan)
    scraper_manager._execute_scrape(source=source, full_scan=full_scan)
    logger.info("CLI execution completed.")

def run_server():
    logger.info("Starting Scraper Service on %s:%d...", settings.HOST, settings.PORT)
    
    # 1. Repair any existing mojibake and reconcile variants in DB
    try:
        db.repair_mojibake()
        db.reconcile_variants()
    except Exception as e:
        logger.warning("Startup DB repair error: %s", e)

    # 2. Start Scheduler
    scraper_manager.start_scheduler()

    # 3. Scrape on startup if enabled
    if settings.SCRAPE_ON_STARTUP:
        logger.info("SCRAPE_ON_STARTUP is enabled: initiating background startup scrape...")
        scraper_manager.trigger_scrape()

    # 4. Start Web API Server
    try:
        uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level="info")
    finally:
        logger.info("Shutting down scraper service...")
        scraper_manager.shutdown()

if __name__ == "__main__":
    args = parse_args()
    if args.repair:
        logger.info("Running database repair (mojibake and variants)...")
        db.repair_mojibake()
        db.reconcile_variants()
        logger.info("Repair finished.")
    elif args.now:
        run_cli(source=args.source, full_scan=args.full)
    else:
        run_server()
