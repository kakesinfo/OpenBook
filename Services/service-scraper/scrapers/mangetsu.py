import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text, split_author_name
from scrapers.urban_comics import parse_french_date

logger = logging.getLogger(__name__)

class MangetsuScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "mangetsu"

    @property
    def display_name(self) -> str:
        return "Mangetsu"

    @property
    def description(self) -> str:
        return "Mangas seinen, shonen & nouveautés japonaises"

    @property
    def color(self) -> str:
        return "#f59e0b"

    def scrape(self, max_items: int = 50, full_scan: bool = False, on_book_found: Optional[Callable[[ScrapedBook], None]] = None, is_stopped: Optional[Callable[[], bool]] = None) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        base_url = "https://mangetsu-manga.fr"
        catalog_urls = [
            f"{base_url}/catalogue/",
            f"{base_url}/catalogue/a-paraitre/",
            f"{base_url}/catalogue/collections/mangetsu-seinen/",
            f"{base_url}/catalogue/collections/mangetsu-shonen/",
            f"{base_url}/catalogue/collections/mangetsu-junji-ito/",
            f"{base_url}/catalogue/collections/mangetsu-koten/",
            f"{base_url}/catalogue/collections/mangetsu-life/",
            f"{base_url}/catalogue/collections/mangetsu-tetsuo-hara/",
        ]

        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_links = set()
        product_links = []

        for cat_url in catalog_urls:
            if is_stopped and is_stopped():
                break
            if not full_scan and len(product_links) >= max_items:
                break
            try:
                logger.info("Mangetsu: Fetching listing %s", cat_url)
                resp = session.get(cat_url, timeout=settings.REQUEST_TIMEOUT)
                if resp.status_code != 200:
                    continue

                page_text = resp.content.decode("utf-8", errors="replace")
                soup = BeautifulSoup(page_text, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if re.search(r"/catalogue/978\d+", href):
                        full_url = href if href.startswith("http") else f"{base_url}{href}"
                        if full_url not in seen_links:
                            seen_links.add(full_url)
                            product_links.append(full_url)
                            if not full_scan and len(product_links) >= max_items:
                                break
            except Exception as e:
                logger.error("Mangetsu: error loading %s: %s", cat_url, e)

        logger.info("Mangetsu: Found %d product pages to scrape", len(product_links))

        for prod_url in product_links:
            if is_stopped and is_stopped():
                break
            try:
                book = self._scrape_book_page(session, prod_url)
                if book:
                    books.append(book)
                    if on_book_found:
                        try:
                            on_book_found(book)
                        except Exception as cb_err:
                            logger.warning("Mangetsu: on_book_found error: %s", cb_err)
            except Exception as e:
                logger.error("Mangetsu: error parsing %s: %s", prod_url, e)

        logger.info("Mangetsu: Finished, scraped %d books", len(books))
        return books

    def _scrape_book_page(self, session: requests.Session, url: str) -> Optional[ScrapedBook]:
        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        page_content = resp.content.decode("utf-8", errors="replace")
        soup = BeautifulSoup(page_content, "html.parser")

        # 1. Title
        title = None
        h1 = soup.find("h1")
        if h1:
            title = clean_text(h1.get_text(strip=True))

        if not title:
            slug = url.strip("/").split("/")[-1]
            title = clean_text(re.sub(r"^\d+-", "", slug).replace("-", " ").title())

        # 2. ISBN
        isbn = None
        isbn_m = re.search(r"(978[-\s0-9]{10,15})", page_content)
        if isbn_m:
            isbn = re.sub(r"[-\s]", "", isbn_m.group(1))
        elif re.search(r"/catalogue/(978\d{10})", url):
            isbn = re.search(r"/catalogue/(978\d{10})", url).group(1)

        # 3. Cover image
        cover_url = None
        if isbn:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                if isbn in src:
                    cover_url = src
                    break
        if not cover_url:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                if "/media/cache/" in src:
                    cover_url = src
                    break

        # 4. Pages
        page_count = 0
        pages_m = re.search(r"Nombre de pages\s*([0-9]+)", page_content, re.I)
        if pages_m:
            page_count = int(pages_m.group(1))

        # 5. Date de parution
        release_date = None
        date_m = re.search(r"Parution\s*:\s*([^<\n\r]+)", page_content, re.I)
        if date_m:
            release_date = parse_french_date(date_m.group(1))
        if not release_date:
            release_date = datetime.now()

        # 6. Description
        description = None
        desc_div = soup.find("div", class_=re.compile(r"description|resume|synopsis"))
        if desc_div:
            description = clean_text(desc_div.get_text(strip=True))
        if not description:
            # Look for long paragraph
            for p in soup.find_all("p"):
                t = p.get_text(strip=True)
                if len(t) > 80 and not any(k in t.lower() for k in ["cookie", "contact", "newsletter"]):
                    description = clean_text(t)
                    break

        # 7. Authors
        authors: List[ScrapedAuthor] = []
        author_m = re.search(r"Auteursde l['’]œuvre\s*([A-Za-zÀ-ÿ\s\-]+)Auteur", page_content)
        if author_m:
            a_name = author_m.group(1).strip()
            fn, ln = split_author_name(a_name)
            if ln:
                authors.append(ScrapedAuthor(firstname=fn, lastname=ln))

        # 8. Series & Volume
        series_name = title
        volume = None
        vol_m = re.search(r"T(?:ome)?\s*0?(\d+)", title, re.I)
        if vol_m:
            volume = int(vol_m.group(1))
            series_name = re.sub(r"T(?:ome)?\s*0?\d+.*", "", title, flags=re.I).strip(" -:")

        return ScrapedBook(
            title=title[:255],
            series_name=series_name[:255],
            volume=volume,
            isbn=isbn,
            editor_name="Mangetsu",
            category_name="Manga",
            page_count=page_count,
            price=8,  # Standard Mangetsu manga price (~7.95-8.95)
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Manga",
            authors=authors,
            source_url=url
        )
