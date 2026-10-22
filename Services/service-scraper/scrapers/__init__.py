from typing import Dict, Type
from scrapers.base import BaseScraper
from scrapers.urban_comics import UrbanComicsScraper
from scrapers.panini_comics import PaniniComicsScraper
from scrapers.morgen_bd import MorgenBDScraper
from scrapers.mangetsu import MangetsuScraper
from scrapers.label619 import Label619Scraper
from scrapers.monsieur_toussaint_louverture import MonsieurToussaintLouvertureScraper

SCRAPERS: Dict[str, Type[BaseScraper]] = {
    "urban_comics": UrbanComicsScraper,
    "panini": PaniniComicsScraper,
    "morgen_bd": MorgenBDScraper,
    "mangetsu": MangetsuScraper,
    "label619": Label619Scraper,
    "monsieur_toussaint_louverture": MonsieurToussaintLouvertureScraper,
}

def get_scraper(name: str) -> BaseScraper:
    scraper_cls = SCRAPERS.get(name)
    if not scraper_cls:
        raise ValueError(f"Unknown scraper: {name}. Available: {list(SCRAPERS.keys())}")
    return scraper_cls()
