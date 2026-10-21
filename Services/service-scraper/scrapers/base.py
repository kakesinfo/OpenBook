import html
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any

def clean_text(text: Optional[str]) -> Optional[str]:
    """
    Cleans raw scraped text:
    - Decodes HTML entities (e.g. &#x27; -> ')
    - Automatically repairs double-encoded UTF-8 / mojibake (e.g. dÃ©mon -> démon)
    - Strips leading/trailing spaces and normalizes non-breaking spaces
    """
    if not text:
        return text
    
    # 1. Unescape HTML entities
    cleaned = html.unescape(text)

    # 2. Fix mojibake / double-encoded UTF-8
    try:
        if any(c in cleaned for c in ["Ã", "Â", "â€", "â™"]):
            cleaned = cleaned.encode("latin1").decode("utf-8")
    except Exception:
        pass

    # 3. Clean non-breaking spaces and extra whitespace
    cleaned = cleaned.replace("\xa0", " ").strip()
    return cleaned

@dataclass
class ScrapedAuthor:
    firstname: str
    lastname: str
    role: str = "Writer"  # 'Writer', 'Illustrator', 'Colorist'

@dataclass
class ScrapedBook:
    title: str
    series_name: Optional[str] = None
    volume: Optional[int] = None
    isbn: Optional[str] = None
    editor_name: Optional[str] = None
    category_name: str = "Comics"
    page_count: Optional[int] = 0
    price: Optional[int] = 0
    description: Optional[str] = None
    cover_url: Optional[str] = None
    release_date: Optional[datetime] = None
    book_type: Optional[str] = "Comics"
    authors: List[ScrapedAuthor] = field(default_factory=list)
    source_url: Optional[str] = None

class BaseScraper(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the scraper/source (e.g. 'urban_comics', 'panini', 'morgen_bd', 'mangetsu', 'label619')"""
        pass

    @abstractmethod
    def scrape(self, max_items: int = 50, full_scan: bool = False) -> List[ScrapedBook]:
        """Scrape books from the source and return a list of ScrapedBook objects."""
        pass
