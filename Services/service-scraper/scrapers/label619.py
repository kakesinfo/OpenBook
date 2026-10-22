import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable
import requests

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text, split_author_name

logger = logging.getLogger(__name__)


class Label619Scraper(BaseScraper):
    @property
    def name(self) -> str:
        return "label619"

    @property
    def display_name(self) -> str:
        return "Label 619"

    @property
    def description(self) -> str:
        return "Catalogue officiel Label 619 (Mutafukaz, Rue de Sèvres, BD alternatives)"

    @property
    def color(self) -> str:
        return "#ec4899"

    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        """
        Scrapes https://label619.com/catalogue and retrieves their entire catalog.
        Simulates the pagination triggered by the '.catalogue__btn.main-button' button
        ("afficher plus de titres") via the Strapi API endpoint /sk/api/editions.
        """
        books: List[ScrapedBook] = []
        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "application/json, text/html, */*",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_titles = set()
        page = 1
        page_size = 40  # Batch size matching the .catalogue__btn.main-button clicks
        api_base = "https://label619.com/sk/api/editions"

        logger.info(
            "Label619: Scraping catalogue from https://label619.com/catalogue (full_scan=%s, max_items=%d)...",
            full_scan,
            max_items
        )

        try:
            while True:
                if is_stopped and is_stopped():
                    logger.info("Label619: Stop requested, halting scrape.")
                    break

                url = (
                    f"{api_base}?"
                    f"sort[0]=date:desc&"
                    f"pagination[pageSize]={page_size}&"
                    f"pagination[page]={page}&"
                    f"populate[cover][populate]=*&"
                    f"populate[collections][populate]=*"
                )

                try:
                    resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
                except Exception as req_err:
                    logger.warning("Label619: Request error on page %d: %s", page, req_err)
                    break

                if resp.status_code != 200:
                    logger.warning("Label619: API returned status %s on page %d", resp.status_code, page)
                    break

                data = resp.json()
                items = data.get("data", [])
                meta = data.get("meta", {}).get("pagination", {})
                page_count = meta.get("pageCount", 1)

                logger.info(
                    "Label619: Fetched catalogue page %d/%d (%d albums, total catalogue: %s)",
                    page,
                    page_count,
                    len(items),
                    meta.get("total", "N/A")
                )

                for item in items:
                    if is_stopped and is_stopped():
                        break

                    raw_title = item.get("title")
                    if not raw_title:
                        continue

                    title = clean_text(raw_title)
                    if not title or title in seen_titles:
                        continue
                    seen_titles.add(title)

                    # Tome / Volume
                    tome_val = item.get("tome")
                    volume = None
                    if tome_val is not None:
                        try:
                            volume = int(tome_val)
                        except (ValueError, TypeError):
                            pass
                    if volume is None:
                        vol_m = re.search(r"T(?:ome)?\s*0?(\d+)", title, re.I)
                        if vol_m:
                            volume = int(vol_m.group(1))

                    # Series name
                    series_name = title
                    if volume is not None:
                        cleaned_series = re.sub(r"T(?:ome)?\s*0?\d+.*", "", title, flags=re.I).strip(" -:")
                        if cleaned_series:
                            series_name = clean_text(cleaned_series)

                    # Price
                    price = 0
                    price_raw = item.get("price")
                    if price_raw is not None:
                        m_p = re.search(r"(\d+)(?:[,\.]\d+)?", str(price_raw))
                        if m_p:
                            price = int(m_p.group(1))

                    # ISBN from external store link if available (librairiesindependantes, etc.)
                    link = item.get("link") or ""
                    isbn = None
                    m_isbn = re.search(r"(97[89]\d{10})", link)
                    if m_isbn:
                        isbn = m_isbn.group(1)

                    # Cover image URL
                    cover_url = None
                    cover_data = item.get("cover")
                    if isinstance(cover_data, dict):
                        formats = cover_data.get("formats") or {}
                        url_path = (
                            formats.get("large", {}).get("url")
                            or formats.get("medium", {}).get("url")
                            or formats.get("small", {}).get("url")
                            or cover_data.get("url")
                        )
                        if url_path:
                            if url_path.startswith("http"):
                                cover_url = url_path
                            elif url_path.startswith("/sk"):
                                cover_url = f"https://label619.com{url_path}"
                            else:
                                cover_url = f"https://label619.com/sk{url_path}"

                    # Release date
                    release_date = None
                    date_str = item.get("date")
                    if date_str:
                        try:
                            release_date = datetime.strptime(date_str[:10], "%Y-%m-%d")
                        except Exception:
                            pass

                    # Summary / Description
                    description = clean_text(item.get("summary")) or f"Album Label 619 : {title}"

                    # Authors (stored under Strapi 'collections' relation)
                    authors: List[ScrapedAuthor] = []
                    collections = item.get("collections") or []
                    for col in collections:
                        if isinstance(col, dict):
                            author_name = col.get("name") or ""
                            fn, ln = split_author_name(author_name)
                            if ln:
                                authors.append(ScrapedAuthor(firstname=fn, lastname=ln, role="Writer"))

                    book_obj = ScrapedBook(
                        title=title[:255],
                        series_name=(series_name or title)[:255],
                        volume=volume,
                        isbn=isbn,
                        editor_name="Label 619",
                        category_name="Comics",
                        page_count=0,
                        price=price,
                        description=description,
                        cover_url=cover_url,
                        release_date=release_date or datetime.now(),
                        book_type="Comics",
                        authors=authors,
                        source_url=link or "https://label619.com/catalogue"
                    )

                    books.append(book_obj)
                    if on_book_found:
                        try:
                            on_book_found(book_obj)
                        except Exception as cb_err:
                            logger.warning("Label619: on_book_found error: %s", cb_err)

                    if not full_scan and len(books) >= max_items:
                        logger.info("Label619: Reached max_items (%d), ending scan", max_items)
                        break

                if not full_scan and len(books) >= max_items:
                    break

                if page >= page_count or not items:
                    break

                page += 1

        except Exception as e:
            logger.error("Label619: error scraping catalogue: %s", e, exc_info=True)

        logger.info("Label619: Finished catalogue scrape, collected %d books", len(books))
        return books
