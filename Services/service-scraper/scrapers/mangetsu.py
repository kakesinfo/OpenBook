import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

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

    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        base_url = "https://mangetsu-manga.fr"

        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_links = set()
        product_links: List[str] = []
        card_hints: Dict[str, Dict[str, Any]] = {}

        # 1. Scrape listing entrypoints:
        # - https://mangetsu-manga.fr/a-paraitre/ (Releases to come - vital for upcoming planning)
        # - https://mangetsu-manga.fr/catalogue/ (Complete catalogue with pagination via div.pagination)
        listing_start_urls = [
            f"{base_url}/a-paraitre/",
            f"{base_url}/catalogue/"
        ]

        logger.info("Mangetsu: Starting listing crawl (full_scan=%s, max_items=%d)", full_scan, max_items)

        for start_url in listing_start_urls:
            if is_stopped and is_stopped():
                break
            if not full_scan and len(product_links) >= max_items:
                break

            current_url = start_url
            visited_pages = set()

            while current_url and current_url not in visited_pages:
                if is_stopped and is_stopped():
                    break
                if not full_scan and len(product_links) >= max_items:
                    break

                visited_pages.add(current_url)
                logger.info("Mangetsu: Fetching listing page %s", current_url)

                try:
                    resp = session.get(current_url, timeout=settings.REQUEST_TIMEOUT)
                    if resp.status_code != 200:
                        logger.warning("Mangetsu: Listing page %s returned status %d", current_url, resp.status_code)
                        break

                    page_text = resp.content.decode("utf-8", errors="replace")
                    soup = BeautifulSoup(page_text, "html.parser")

                    # Extract books from book cards or product links
                    cards = soup.select(".book-card")
                    for card in cards:
                        href = card.get("href")
                        if href and re.search(r"/catalogue/978\d+", href):
                            full_url = urljoin(base_url, href)
                            if full_url not in seen_links:
                                seen_links.add(full_url)
                                product_links.append(full_url)

                            # Save hints from card
                            date_el = card.select_one(".book-card__date")
                            title_el = card.select_one(".book-card__title")
                            tome_el = card.select_one(".book-card__tome")
                            author_el = card.select_one(".book-card__author")
                            img_el = card.select_one(".book-card__img")

                            card_hints[full_url] = {
                                "date_str": clean_text(date_el.get_text(strip=True)) if date_el else None,
                                "title": clean_text(title_el.get_text(strip=True)) if title_el else None,
                                "tome": clean_text(tome_el.get_text(strip=True)) if tome_el else None,
                                "author_str": clean_text(author_el.get_text(strip=True)) if author_el else None,
                                "cover_url": img_el.get("src") if img_el else None
                            }

                            if not full_scan and len(product_links) >= max_items:
                                break

                    # Also check for any standalone links matching /catalogue/978\d+ not in .book-card
                    for a in soup.find_all("a", href=True):
                        href = a["href"]
                        if re.search(r"/catalogue/978\d+", href):
                            full_url = urljoin(base_url, href)
                            if full_url not in seen_links:
                                seen_links.add(full_url)
                                product_links.append(full_url)
                                if not full_scan and len(product_links) >= max_items:
                                    break

                    # Handle pagination using div.pagination
                    current_url = self._extract_next_page_url(soup, current_url, base_url, visited_pages)

                except Exception as e:
                    logger.error("Mangetsu: error loading listing %s: %s", current_url, e)
                    break

        logger.info("Mangetsu: Found %d product pages to scrape", len(product_links))

        # 2. Scrape individual book details
        for prod_url in product_links:
            if is_stopped and is_stopped():
                break
            try:
                hint = card_hints.get(prod_url)
                book = self._scrape_book_page(session, prod_url, hint=hint)
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

    def _extract_next_page_url(
        self,
        soup: BeautifulSoup,
        current_url: str,
        base_url: str,
        visited_pages: set
    ) -> Optional[str]:
        """
        Extracts the next page URL using div.pagination.
        Checks for <a rel="next"> or class/text 'next', and falls back to numeric page checks.
        """
        pagination = soup.find("div", class_="pagination")
        if not pagination:
            return None

        # 1. Primary: search for <a rel="next"> or class 'next' or text 'Next'
        next_a = (
            pagination.find("a", rel="next") or
            pagination.find("a", class_=re.compile(r"next", re.I)) or
            pagination.find("a", string=re.compile(r"next", re.I))
        )
        if next_a and next_a.get("href"):
            next_url = urljoin(base_url, next_a["href"].strip())
            if next_url not in visited_pages:
                return next_url

        # 2. Fallback: inspect page numbers in div.pagination
        page_match = re.search(r"[?&]page=(\d+)", current_url)
        cur_page = int(page_match.group(1)) if page_match else 1
        max_page = cur_page

        for a in pagination.find_all("a", href=True):
            m = re.search(r"[?&]page=(\d+)", a["href"])
            if m:
                max_page = max(max_page, int(m.group(1)))

        if cur_page < max_page:
            clean_base = re.sub(r"[?&]page=\d+", "", current_url)
            sep = "&" if "?" in clean_base else "?"
            candidate = f"{clean_base}{sep}page={cur_page + 1}"
            if candidate not in visited_pages:
                return candidate

        return None

    def _scrape_book_page(
        self,
        session: requests.Session,
        url: str,
        hint: Optional[Dict[str, Any]] = None
    ) -> Optional[ScrapedBook]:
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

        if not title and hint and hint.get("title"):
            title = hint["title"]

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
        if not cover_url and hint and hint.get("cover_url"):
            cover_url = hint["cover_url"]

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
        if not release_date and hint and hint.get("date_str"):
            release_date = parse_french_date(hint["date_str"])
        if not release_date:
            release_date = datetime.now()

        # 6. Description
        description = None
        desc_div = soup.find("div", class_=re.compile(r"description|resume|synopsis"))
        if desc_div:
            description = clean_text(desc_div.get_text(strip=True))
        if not description:
            for p in soup.find_all("p"):
                t = p.get_text(strip=True)
                if len(t) > 80 and not any(k in t.lower() for k in ["cookie", "contact", "newsletter"]):
                    description = clean_text(t)
                    break

        # 7. Authors
        authors: List[ScrapedAuthor] = []
        author_cards = soup.select(".author-card__name")
        if author_cards:
            for ac in author_cards:
                a_name = clean_text(ac.get_text(strip=True))
                if a_name:
                    fn, ln = split_author_name(a_name)
                    if ln or fn:
                        authors.append(ScrapedAuthor(firstname=fn, lastname=ln))
        if not authors:
            h2_author = soup.select_one("h2.book__author")
            if h2_author:
                for a_name in h2_author.get_text(strip=True).split(","):
                    a_name = clean_text(a_name)
                    if a_name:
                        fn, ln = split_author_name(a_name)
                        if ln or fn:
                            authors.append(ScrapedAuthor(firstname=fn, lastname=ln))
        if not authors and hint and hint.get("author_str"):
            for a_name in hint["author_str"].split(","):
                a_name = clean_text(a_name)
                if a_name:
                    fn, ln = split_author_name(a_name)
                    if ln or fn:
                        authors.append(ScrapedAuthor(firstname=fn, lastname=ln))

        # 8. Price
        price = 8
        price_span = soup.select_one(".price__value")
        if price_span:
            p_match = re.search(r"(\d+)[,.]?(\d+)?", price_span.get_text(strip=True))
            if p_match:
                price = int(p_match.group(1))

        # 9. Series & Volume
        series_name = title
        volume = None
        vol_m = re.search(r"T(?:ome)?\s*0?(\d+)", title, re.I)
        if not vol_m and hint and hint.get("tome"):
            vol_m = re.search(r"T(?:ome|\.)?\s*0?(\d+)", hint["tome"], re.I)

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
            price=price,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Manga",
            authors=authors,
            source_url=url
        )
