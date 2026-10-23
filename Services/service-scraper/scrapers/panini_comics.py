import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable
from urllib.parse import unquote, urljoin
import requests
from bs4 import BeautifulSoup

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, clean_text, is_variant_title

logger = logging.getLogger(__name__)

class PaniniComicsScraper(BaseScraper):
    CATALOG_URLS = [
        "https://www.panini.fr/shp_fra_fr/comics/marvel.html",
        "https://www.panini.fr/shp_fra_fr/comics/star-wars.html",
        "https://www.panini.fr/shp_fra_fr/comics/disney.html",
        "https://www.panini.fr/shp_fra_fr/comics/autres-comics.html"
    ]

    @property
    def name(self) -> str:
        return "panini"

    @property
    def display_name(self) -> str:
        return "Panini Comics"

    @property
    def description(self) -> str:
        return "Marvel, Star Wars, Disney, Autres Comics"

    @property
    def color(self) -> str:
        return "#ef4444"

    @staticmethod
    def extract_next_page_url(soup: BeautifulSoup, current_url: str) -> Optional[str]:
        """
        Extract the next page URL using the 'div.pages ul.pages-items li.item' selector.
        """
        items = soup.select("div.pages ul.pages-items li.item")
        if not items:
            return None

        # 1. Look for the next-page item (.pages-item-next or link with class next or text Suivant)
        for item in items:
            classes = item.get("class", [])
            if "pages-item-next" in classes:
                a = item.find("a", href=True)
                if a and a.get("href"):
                    return urljoin(current_url, a["href"])

            a_next = item.find("a", class_=re.compile(r"\bnext\b"))
            if a_next and a_next.get("href"):
                return urljoin(current_url, a_next["href"])

            if any(w in item.get_text(strip=True).lower() for w in ["suivant", "next"]):
                a = item.find("a", href=True)
                if a and a.get("href"):
                    return urljoin(current_url, a["href"])

        # 2. Fallback: inspect items in sequence to find the item right after 'current'
        found_current = False
        for item in items:
            classes = item.get("class", [])
            if "current" in classes:
                found_current = True
                continue
            if found_current and "pages-item-previous" not in classes:
                a = item.find("a", href=True)
                if a and a.get("href"):
                    return urljoin(current_url, a["href"])

        return None

    def _fetch_page_html(self, session: requests.Session, url: str) -> Optional[str]:
        """
        Fetches page HTML while handling any Panini / Queue-it JavaScript verification redirects.
        """
        current_url = url
        for _ in range(5):
            try:
                resp = session.get(current_url, timeout=settings.REQUEST_TIMEOUT)
                if resp.status_code != 200:
                    logger.warning("Panini returned HTTP %s for %s", resp.status_code, current_url)
                    return None

                html_content = resp.content.decode("utf-8", errors="replace")
                # Detect Queue-it / cookie test JS redirect
                m = re.search(r"decodeURIComponent\(['\"]([^'\"]+)['\"]\)", html_content)
                if m:
                    redirect_path = unquote(m.group(1))
                    current_url = urljoin(resp.url, redirect_path)
                    logger.debug("Panini: following JS/Queue-it redirect to %s", current_url)
                    continue

                return html_content
            except Exception as e:
                logger.error("Panini: request error for %s: %s", current_url, e)
                return None
        return None

    def _parse_card(self, card, base_url: str = "") -> Optional[ScrapedBook]:
        """
        Parses a single product card from listing.
        """
        # Title & Product Link
        raw_title = None
        prod_url = ""
        for a in card.find_all("a", href=True):
            t = a.get_text(strip=True)
            if t and not any(x in t.lower() for x in ["liste d", "panier", "aperçu", "voir"]):
                raw_title = t
                prod_url = urljoin(base_url, a["href"]) if base_url else a["href"]
                break

        if not raw_title:
            img = card.find("img")
            if img and img.get("alt"):
                alt = img["alt"]
                raw_title = re.sub(r"^Panini:\s*Comics[_\s]*", "", alt, flags=re.I).strip()

        if not raw_title:
            return None

        clean_title = clean_text(raw_title)
        if not clean_title:
            return None

        # Price
        price = 0
        price_tag = card.find("span", class_="price")
        if price_tag:
            price_text = price_tag.get_text(strip=True)
            m_price = re.search(r"(\d+)[,\.]\d+", price_text)
            if m_price:
                price = int(m_price.group(1))

        # Cover Image
        cover_url = None
        img_tag = card.find("img", class_=re.compile(r"product-image-photo")) or card.find("img")
        if img_tag:
            cover_url = img_tag.get("src") or img_tag.get("data-src")
            if cover_url:
                cover_url = cover_url.split("?")[0]

        # Series & Volume
        series_name = clean_title
        volume = None
        vol_m = re.search(r"(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?(\d+)", clean_title, re.I)
        if vol_m:
            volume = int(vol_m.group(1))
            series_name = re.sub(r"(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?\d+.*", "", clean_title, flags=re.I).strip(" -:")
        
        if not series_name:
            series_name = clean_title
        series_name = clean_text(series_name)

        # Release date
        release_date = None
        date_el = card.select_one(".product-item-attribute-release-date small, .product-item-attribute-release-date")
        if date_el:
            d_txt = date_el.get_text(strip=True)
            for fmt in ("%d/%m/%y", "%d/%m/%Y"):
                try:
                    release_date = datetime.strptime(d_txt, fmt)
                    break
                except ValueError:
                    pass
        if not release_date:
            release_date = datetime.now()

        # ISBN from product URL slug or SKU code if present
        isbn = None
        if prod_url:
            isbn_m = re.search(r"(97[89]\d{10})", prod_url)
            if isbn_m:
                isbn = isbn_m.group(1)
        if not isbn:
            sku_el = card.select_one("[data-product-sku]")
            if sku_el and sku_el.get("data-product-sku"):
                sku_m = re.search(r"(97[89]\d{10})", sku_el["data-product-sku"])
                if sku_m:
                    isbn = sku_m.group(1)

        is_variant = is_variant_title(clean_title)

        return ScrapedBook(
            title=clean_title[:255],
            series_name=series_name[:255] if series_name else None,
            volume=volume,
            isbn=isbn,
            editor_name="Panini Comics",
            category_name="Comics",
            page_count=0,
            price=price,
            description=f"Édition Panini Comics: {clean_title}",
            cover_url=cover_url,
            release_date=release_date,
            book_type="Comics",
            source_url=prod_url,
            is_variant=is_variant
        )

    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        urls_to_visit = self.CATALOG_URLS

        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_titles = set()
        seen_urls = set()

        for category_url in urls_to_visit:
            if is_stopped and is_stopped():
                break
            if not full_scan and len(books) >= max_items:
                break

            current_page_url: Optional[str] = category_url
            visited_pages = set()

            while current_page_url:
                if is_stopped and is_stopped():
                    break
                if not full_scan and len(books) >= max_items:
                    break
                if current_page_url in visited_pages:
                    break

                visited_pages.add(current_page_url)
                logger.info("Panini: Fetching listing %s", current_page_url)

                html_content = self._fetch_page_html(session, current_page_url)
                if not html_content:
                    logger.warning("Panini: Failed to fetch %s", current_page_url)
                    break

                soup = BeautifulSoup(html_content, "html.parser")
                cards = soup.find_all("li", class_=re.compile(r"item\s+product\s+product-item"))
                if not cards:
                    cards = soup.find_all("div", class_=re.compile(r"product-item-info"))

                for card in cards:
                    if is_stopped and is_stopped():
                        break
                    if not full_scan and len(books) >= max_items:
                        break

                    book = self._parse_card(card, base_url=current_page_url)
                    if not book:
                        continue

                    if book.title in seen_titles or (book.source_url and book.source_url in seen_urls):
                        continue
                    seen_titles.add(book.title)
                    if book.source_url:
                        seen_urls.add(book.source_url)

                    books.append(book)
                    if on_book_found:
                        try:
                            on_book_found(book)
                        except Exception as cb_err:
                            logger.warning("Panini: on_book_found error: %s", cb_err)

                # Extract next page using div.pages ul.pages-items li.item
                current_page_url = self.extract_next_page_url(soup, current_page_url)

        logger.info("Panini: Finished scraping, retrieved %d books", len(books))
        return books
