import html
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Callable, Tuple

def clean_text(text: Optional[str]) -> Optional[str]:
    """
    Cleans raw scraped text:
    - Decodes HTML entities (e.g. &#x27; -> ')
    - Automatically repairs double-encoded UTF-8 / mojibake (e.g. dÃ©mon -> démon)
    - Normalizes unicode dashes/hyphens (–, —, etc.) to standard ASCII hyphen-minus (-)
    - Strips leading/trailing spaces and normalizes non-breaking/multiple spaces
    """
    if not text:
        return text
    
    # 1. Unescape HTML entities
    cleaned = html.unescape(text)

    # 2. Fix mojibake / double-encoded UTF-8
    try:
        if any(c in cleaned for c in ["Ã", "Â", "â€™", "â„¢"]):
            cleaned = cleaned.encode("latin1").decode("utf-8")
    except Exception:
        pass

    # 3. Normalize unicode dashes and quotes
    cleaned = re.sub(r"[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]", "-", cleaned)
    cleaned = re.sub(r"[\u2018\u2019\u201a\u201b]", "'", cleaned)
    cleaned = re.sub(r"[\u201c\u201d\u201e\u201f]", '"', cleaned)

    # 4. Clean non-breaking spaces and collapse duplicate whitespace
    cleaned = re.sub(r"[ \t\xa0\u2000-\u200b]+", " ", cleaned).strip()
    return cleaned


AUTHOR_ROLE_PREFIX_REGEX = re.compile(
    r"^(?:par\s+|de\s+|d['’]|"
    r"texte\s+et\s+illustrations?\s+(?:de\s*)?|"
    r"sc[eé]nariste\s+et\s+dessinateur\s*|"
    r"sc[eé]nario\s+et\s+dessin\s+(?:de\s*)?|"
    r"sc[eé]nario\s+(?:de\s*)?|"
    r"illustrations?\s+(?:de\s*)?|"
    r"dessins?\s+(?:de\s*)?|"
    r"auteurs?\s*(?:\+|/|et)\s*illustrat(?:eur|rice)s?\s*|"
    r"illustrat(?:eur|rice)s?\s*|"
    r"dessinat(?:eur|rice)s?\s*|"
    r"sc[eé]naristes?\s*|"
    r"coloristes?\s*|"
    r"auteurs?\s*|"
    r"auteures?\s*|"
    r"[\+:\-_/]\s*)+",
    re.IGNORECASE
)


def clean_author_name(name: Optional[str]) -> str:
    """
    Cleans raw author name strings by removing role and descriptive prefixes
    such as 'Auteur + illustrateur', 'Texte et illustration de', 'Illustrateur',
    'Scénariste', 'Par', etc.
    """
    if not name:
        return ""
    cleaned = clean_text(name).strip()
    while True:
        m = AUTHOR_ROLE_PREFIX_REGEX.sub("", cleaned).strip(" +:-_/")
        if m == cleaned:
            break
        cleaned = m
    return cleaned


def split_author_name(full_name: Optional[str]) -> Tuple[str, str]:
    """
    Cleans and splits a full author name into (firstname, lastname).
    Handles mononyms (e.g. 'RUN', 'Neyef') by returning ('', 'RUN').
    """
    cleaned = clean_author_name(full_name)
    if not cleaned:
        return ("", "")
    parts = cleaned.split(None, 1)
    if len(parts) == 1:
        return ("", parts[0])
    return (parts[0], parts[1])


@dataclass
class ScrapedAuthor:
    firstname: str
    lastname: str
    role: str = "Writer"  # 'Writer', 'Illustrator', 'Colorist'


@dataclass
class ScrapedBook:
    title: str
    series_name: Optional[str] = None
    series_qualifier: Optional[str] = None
    volume: Optional[int] = None
    isbn: Optional[str] = None
    editor_name: Optional[str] = None
    collection_name: Optional[str] = None
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
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        pass

    @property
    def color(self) -> str:
        return "#6366f1"

    @abstractmethod
    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        pass
