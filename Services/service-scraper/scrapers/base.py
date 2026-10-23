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


VARIANT_COVER_REGEX = re.compile(
    r"\b(?:couverture\s+variante|variant(?:e)?(?:\s+(?:panini|exclusive|site))?|couv\.?\s*var\.?|(?:[eé]dition|coffret)\s+collector|collector|[eé]dition\s+sp[eé]ciale|[eé]dition\s+limit[eé]e|[eé]dition\s+prestige|tirage\s+(?:limit[eé]|de\s+t[eê]te)|(?:version|[eé]dition\s+)?noir\s+et\s+blanc|n&b)\b",
    re.IGNORECASE
)

VARIANT_SUFFIX_REGEX = re.compile(
    r"(?:\s*[-\u2013\u2014:]\s*|\s+)\(?(?:couverture\s+variante|variant(?:e)?(?:\s+(?:panini|exclusive|site))?|couv\.?\s*var\.?|(?:[eé]dition|coffret)\s+collector|collector|[eé]dition\s+sp[eé]ciale|[eé]dition\s+limit[eé]e|[eé]dition\s+prestige|tirage\s+(?:limit[eé]|de\s+t[eê]te)|(?:version|[eé]dition\s+)?noir\s+et\s+blanc|n&b)\b[^\)]*\)?",
    re.IGNORECASE
)

def is_variant_title(title: Optional[str]) -> bool:
    if not title:
        return False
    return bool(VARIANT_COVER_REGEX.search(title))

def strip_variant_suffix(text: Optional[str]) -> str:
    cleaned = clean_text(text) or ""
    res = VARIANT_SUFFIX_REGEX.sub("", cleaned).strip(" -:")
    if res.endswith("(") and res.count("(") > res.count(")"):
        res = res[:-1].strip(" -:")
    if res.endswith(")") and res.count(")") > res.count("("):
        res = res[:-1].strip(" -:")
    return res or cleaned

def is_variant_book(title: Optional[str], cover_url: Optional[str] = None, sku: Optional[str] = None) -> bool:
    if is_variant_title(title):
        return True
    if cover_url and re.search(r"[a-zA-Z0-9]+v_\d+\.(?:jpg|jpeg|png|webp)", cover_url, re.I):
        return True
    if sku and re.search(r"[a-zA-Z0-9]+v(?:_[a-zA-Z0-9]+)?$", sku, re.I):
        return True
    return False

def extract_canonical_series_and_volume(series_or_title: Optional[str]) -> Tuple[str, Optional[int]]:
    cleaned = clean_text(series_or_title) or ""
    vol_m = re.search(r"(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?(\d+)", cleaned, re.I)
    vol = int(vol_m.group(1)) if vol_m else None
    
    base = re.sub(r"(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?\d+.*", "", cleaned, flags=re.I).strip(" -:")
    if base.endswith("(") and base.count("(") > base.count(")"):
        base = base[:-1].strip(" -:")
    if base.endswith(")") and base.count(")") > base.count("("):
        base = base[:-1].strip(" -:")
    base = strip_variant_suffix(base)
    if not base:
        base = cleaned
    return clean_text(base), vol


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
    parent_book_id: Optional[int] = None
    is_variant: bool = False


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
