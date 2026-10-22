import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text

logger = logging.getLogger(__name__)

class MorgenBDScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "morgen_bd"

    @property
    def display_name(self) -> str:
        return "Morgen BD"

    @property
    def description(self) -> str:
        return "Boutique & nouveautés indés Morgen"

    @property
    def color(self) -> str:
        return "#8b5cf6"

    def scrape(self, max_items: int = 50, full_scan: bool = False, on_book_found: Optional[Callable[[ScrapedBook], None]] = None) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        base_url = "https://www.morgen-bd.com"
        listing_url = f"{base_url}/nos-albums"

        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        try:
            logger.info("MorgenBD: Fetching listing %s", listing_url)
            resp = session.get(listing_url, timeout=settings.REQUEST_TIMEOUT)
            if resp.status_code != 200:
                logger.warning("MorgenBD returned HTTP %s for %s", resp.status_code, listing_url)
                return []

            page_content = resp.content.decode("utf-8", errors="replace")
            # Extract links to albums: /livres/<slug>
            matches = set(re.findall(r'href=["\'](/livres/[^"\']+)["\']', page_content))
            book_urls = [f"{base_url}{m}" for m in sorted(matches)]
            logger.info("MorgenBD: Found %d album links", len(book_urls))

            for book_url in book_urls:
                if not full_scan and len(books) >= max_items:
                    break
                try:
                    book = self._scrape_book_page(session, book_url)
                    if book:
                        books.append(book)
                        if on_book_found:
                            try:
                                on_book_found(book)
                            except Exception as cb_err:
                                logger.warning("MorgenBD: on_book_found error: %s", cb_err)
                except Exception as e:
                    logger.error("MorgenBD: error parsing %s: %s", book_url, e)

        except Exception as e:
            logger.error("MorgenBD error: %s", e)

        logger.info("MorgenBD: Finished, scraped %d books", len(books))
        return books

    def _scrape_book_page(self, session: requests.Session, url: str) -> Optional[ScrapedBook]:
        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        page_content = resp.content.decode("utf-8", errors="replace")
        soup = BeautifulSoup(page_content, "html.parser")

        # 1. Title
        title = None
        for h in soup.find_all(["h1", "h2"]):
            t = h.get_text(strip=True)
            if t and not any(k in t.lower() for k in ["résumé", "documentaire", "auteurs", "découvrir", "série", "morgen"]):
                title = clean_text(t)
                break

        if not title:
            # fallback from URL slug
            slug = url.split("/livres/")[-1]
            title = clean_text(slug.replace("-", " ").title())

        # 2. Cover image
        cover_url = None
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if "CV_" in src or "couv" in src.lower() or "website-files.com" in src:
                if not any(x in src.lower() for x in ["favicon", "icon", "logo", "whatssap", "facebook"]):
                    cover_url = src
                    break

        # 3. Text metadata (Date, Prix, ISBN, Pages)
        full_text = soup.get_text()
        
        # ISBN
        isbn = None
        isbn_m = re.search(r"(97[89][-\s0-9]{10,15})", full_text)
        if isbn_m:
            isbn = re.sub(r"[-\s]", "", isbn_m.group(1))

        # Price
        price = 0
        price_m = re.search(r"prix\s*:\s*([0-9]+)[,\.]([0-9]+)\s*€", full_text, re.I)
        if price_m:
            price = int(price_m.group(1))

        # Pages
        page_count = 0
        pages_m = re.search(r"numérique\s*:\s*([0-9]+)", full_text, re.I)
        if pages_m:
            page_count = int(pages_m.group(1))

        # Date
        release_date = None
        date_m = re.search(r"parution\s*([0-9]{2}/[0-9]{2}/[0-9]{4})", full_text, re.I)
        if date_m:
            try:
                release_date = datetime.strptime(date_m.group(1), "%d/%m/%Y")
            except Exception:
                pass
        if not release_date:
            release_date = datetime.now()

        # 4. Description
        description = None
        for p in soup.find_all("p"):
            t = p.get_text(strip=True)
            if len(t) > 60 and not any(k in t.lower() for k in ["cookie", "droits réservés", "newsletter"]):
                description = clean_text(t)
                break

        # 5. Authors
        authors: List[ScrapedAuthor] = []
        author_m = re.search(r"Black Orion([A-Za-zÀ-ÿ\s]+)prix", full_text)
        if author_m:
            name = author_m.group(1).strip()
            parts = name.split()
            if len(parts) >= 2:
                authors.append(ScrapedAuthor(firstname=parts[0], lastname=" ".join(parts[1:])))

        # 6. Series & Volume
        series_name = title
        volume = None
        vol_m = re.search(r"tome\s*(\d+)", title, re.I)
        if vol_m:
            volume = int(vol_m.group(1))
            series_name = re.sub(r"tome\s*\d+.*", "", title, flags=re.I).strip(" -:")

        return ScrapedBook(
            title=title[:255],
            series_name=series_name[:255],
            volume=volume,
            isbn=isbn,
            editor_name="Morgen BD",
            category_name="Bande dessinée",
            page_count=page_count,
            price=price,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Cartonné",
            authors=authors,
            source_url=url
        )
