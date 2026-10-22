import re
import html
import logging
from datetime import datetime
from typing import List, Optional
import requests
from bs4 import BeautifulSoup

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, clean_text

logger = logging.getLogger(__name__)

class PaniniComicsScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "panini"

    @property
    def display_name(self) -> str:
        return "Panini Comics"

    @property
    def description(self) -> str:
        return "Marvel, Star Wars, Panini Manga"

    @property
    def color(self) -> str:
        return "#ef4444"

    def scrape(self, max_items: int = 50, full_scan: bool = False) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        urls_to_visit = [
            "https://www.panini.fr/shp_fra_fr/comics.html",
            "https://www.panini.fr/shp_fra_fr/comics/marvel.html",
            "https://www.panini.fr/shp_fra_fr/comics/star-wars.html"
        ]
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_titles = set()

        for list_url in urls_to_visit:
            if not full_scan and len(books) >= max_items:
                break
            logger.info("Panini: Fetching listing %s", list_url)
            try:
                resp = session.get(list_url, timeout=settings.REQUEST_TIMEOUT)
                if resp.status_code != 200:
                    logger.warning("Panini returned HTTP %s for %s", resp.status_code, list_url)
                    continue

                html_content = resp.content.decode("utf-8", errors="replace")
                soup = BeautifulSoup(html_content, "html.parser")
                cards = soup.find_all("li", class_=re.compile(r"item\s+product\s+product-item"))
                if not cards:
                    cards = soup.find_all("div", class_=re.compile(r"product-item-info"))

                for card in cards:
                    if not full_scan and len(books) >= max_items:
                        break

                    # Title & Product Link
                    raw_title = None
                    prod_url = ""
                    for a in card.find_all("a", href=True):
                        t = a.get_text(strip=True)
                        if t and not any(x in t.lower() for x in ["liste d", "panier", "aperçu", "voir"]):
                            raw_title = t
                            prod_url = a["href"]
                            break

                    if not raw_title:
                        img = card.find("img")
                        if img and img.get("alt"):
                            alt = img["alt"]
                            raw_title = re.sub(r"^Panini:\s*Comics[_\s]*", "", alt, flags=re.I).strip()

                    if not raw_title:
                        continue

                    clean_title = clean_text(raw_title)
                    if clean_title in seen_titles:
                        continue
                    seen_titles.add(clean_title)

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
                    vol_m = re.search(r"T(?:ome)?\s*0?(\d+)", clean_title, re.I)
                    if vol_m:
                        volume = int(vol_m.group(1))
                        series_name = re.sub(r"T(?:ome)?\s*0?\d+.*", "", clean_title, flags=re.I).strip(" -:")
                    
                    if not series_name:
                        series_name = clean_title
                    series_name = clean_text(series_name)

                    # ISBN from product URL slug or code if present
                    isbn = None
                    if prod_url:
                        isbn_m = re.search(r"(97[89]\d{10})", prod_url)
                        if isbn_m:
                            isbn = isbn_m.group(1)

                    book = ScrapedBook(
                        title=clean_title[:255],
                        series_name=series_name[:255],
                        volume=volume,
                        isbn=isbn,
                        editor_name="Panini Comics",
                        category_name="Comics",
                        page_count=0,
                        price=price,
                        description=f"Édition Panini Comics: {clean_title}",
                        cover_url=cover_url,
                        release_date=datetime.now(),
                        book_type="Comics",
                        source_url=prod_url
                    )
                    books.append(book)

            except Exception as e:
                logger.error("Panini: error scraping %s: %s", list_url, e)

        logger.info("Panini: Finished scraping, retrieved %d books", len(books))
        return books
