import re
import html
import logging
from datetime import datetime
from typing import List, Optional
import requests
from bs4 import BeautifulSoup

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text
from scrapers.urban_comics import parse_french_date

logger = logging.getLogger(__name__)

EXCLUDED_SLUGS = {
    "catalogue", "cgu", "connexion", "nos-evenements", "evenements",
    "foreign-rights", "plan-du-site", "politique-de-confidentialite",
    "nos-univers", "mentions-legales", "contact", "qui-sommes-nous",
    "actualites", "auteurs", "label-619", "collections"
}

class Label619Scraper(BaseScraper):
    @property
    def name(self) -> str:
        return "label619"

    def scrape(self, max_items: int = 50, full_scan: bool = False) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_isbns = set()
        seen_titles = set()

        # Source 1: Direct cards from label619.com homepage
        try:
            logger.info("Label619: Fetching https://label619.com/")
            resp = session.get("https://label619.com/", timeout=settings.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                html_text = resp.content.decode("utf-8", errors="replace")
                soup = BeautifulSoup(html_text, "html.parser")
                cards = soup.find_all("a", class_=lambda x: x and "catalogue-card" in x)
                for c in cards:
                    title = clean_text(c.get("title", ""))
                    if not title or title in seen_titles:
                        continue
                    seen_titles.add(title)

                    # ISBN from href
                    href = c.get("href", "")
                    isbn = None
                    m_isbn = re.search(r"product/([0-9]{13})", href)
                    if m_isbn:
                        isbn = m_isbn.group(1)
                        seen_isbns.add(isbn)

                    # Cover image
                    cover_url = None
                    img = c.find("img")
                    if img and img.get("src"):
                        src = img["src"]
                        cover_url = src if src.startswith("http") else f"https://label619.com{src}"

                    # Price
                    price = 0
                    price_div = c.find("div", class_=lambda x: x and "price" in x)
                    if price_div:
                        m_p = re.search(r"(\d+)[,\.]\d+", price_div.get_text(strip=True))
                        if m_p:
                            price = int(m_p.group(1))

                    # Series & Volume
                    series_name = title
                    volume = None
                    vol_m = re.search(r"T(?:ome)?\s*0?(\d+)", title, re.I)
                    if vol_m:
                        volume = int(vol_m.group(1))
                        series_name = re.sub(r"T(?:ome)?\s*0?\d+.*", "", title, flags=re.I).strip(" -:")

                    books.append(ScrapedBook(
                        title=title[:255],
                        series_name=series_name[:255],
                        volume=volume,
                        isbn=isbn,
                        editor_name="Label 619",
                        category_name="Comics",
                        page_count=0,
                        price=price,
                        description=f"Album Label 619 : {title}",
                        cover_url=cover_url,
                        release_date=datetime.now(),
                        book_type="Comics",
                        source_url="https://label619.com/"
                    ))
        except Exception as e:
            logger.error("Label619: error scraping label619.com: %s", e)

        # Source 2: Full catalog from editions-ruedesevres.fr/label-619
        try:
            rds_url = "https://www.editions-ruedesevres.fr/label-619"
            logger.info("Label619: Fetching full catalog from %s", rds_url)
            resp = session.get(rds_url, timeout=settings.REQUEST_TIMEOUT)
            if resp.status_code == 200:
                html_text = resp.content.decode("utf-8", errors="replace")
                soup = BeautifulSoup(html_text, "html.parser")
                rds_book_links = set()
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    slug = href.strip("/").lower()
                    if href.startswith("/") and len(slug) > 2 and slug not in EXCLUDED_SLUGS and not any(k in slug for k in EXCLUDED_SLUGS):
                        full_book_url = f"https://www.editions-ruedesevres.fr{href}"
                        rds_book_links.add(full_book_url)

                logger.info("Label619: Found %d album pages on Rue de Sèvres", len(rds_book_links))

                for book_url in sorted(rds_book_links):
                    if not full_scan and len(books) >= max_items:
                        break
                    try:
                        b = self._scrape_rds_book_page(session, book_url)
                        if b and b.title not in seen_titles:
                            seen_titles.add(b.title)
                            if b.isbn:
                                seen_isbns.add(b.isbn)
                            books.append(b)
                    except Exception as e:
                        logger.error("Label619: error scraping %s: %s", book_url, e)

        except Exception as e:
            logger.error("Label619: error scraping Rue de Sèvres: %s", e)

        logger.info("Label619: Finished, scraped %d books", len(books))
        return books

    def _scrape_rds_book_page(self, session: requests.Session, url: str) -> Optional[ScrapedBook]:
        slug = url.strip("/").split("/")[-1].lower()
        if slug in EXCLUDED_SLUGS:
            return None

        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        page_content = resp.content.decode("utf-8", errors="replace")
        soup = BeautifulSoup(page_content, "html.parser")

        # Must have ISBN or Cover to be considered a book page
        page_text = soup.get_text()
        isbn = None
        m_isbn = re.search(r"Ean\s*/\s*isbn\s*:\s*([0-9]{10,13})", page_text, re.I)
        if m_isbn:
            isbn = m_isbn.group(1)
        
        if not isbn and not ("couv" in page_content.lower() or "parution" in page_content.lower()):
            return None

        # 1. Title
        title = None
        h1 = soup.find("h1")
        if h1:
            title = clean_text(h1.get_text(strip=True))
        if not title:
            title = clean_text(url.strip("/").split("/")[-1].replace("-", " ").title())

        if title.lower() in EXCLUDED_SLUGS:
            return None

        # 2. Cover image
        cover_url = None
        for img in soup.find_all("img"):
            src = img.get("src", "")
            if "medias.edl.li" in src and "_C.jpg" in src:
                cover_url = src
                break
        if not cover_url:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                if "couv" in src.lower() or "visuels" in src.lower():
                    cover_url = src
                    break

        # Price
        price = 0
        m_price = re.search(r"Prix\s*:\s*([0-9]+)[,\.]([0-9]+)\s*€", page_text, re.I)
        if m_price:
            price = int(m_price.group(1))

        # Pages
        page_count = 0
        m_pages = re.search(r"Nombre de pages\s*:\s*([0-9]+)", page_text, re.I)
        if m_pages:
            page_count = int(m_pages.group(1))

        # Date
        release_date = None
        m_date = re.search(r"Date de parution\s*:\s*([^<\n\r]+)", page_text, re.I)
        if m_date:
            release_date = parse_french_date(m_date.group(1))
        if not release_date:
            release_date = datetime.now()

        # 4. Description
        description = None
        for div in soup.find_all("div", class_=re.compile(r"synopsis|resume|description|chapo")):
            t = div.get_text(strip=True)
            if len(t) > 60:
                description = clean_text(t)
                break
        if not description:
            for p in soup.find_all("p"):
                t = p.get_text(strip=True)
                if len(t) > 80 and not any(k in t.lower() for k in ["cookie", "droits", "newsletter"]):
                    description = clean_text(t)
                    break

        # 5. Authors
        authors: List[ScrapedAuthor] = []
        for a_tag in soup.find_all("a", href=re.compile(r"/auteur/")):
            a_name = clean_text(a_tag.get_text(strip=True))
            if a_name:
                parts = a_name.split()
                if len(parts) >= 2:
                    authors.append(ScrapedAuthor(firstname=parts[0], lastname=" ".join(parts[1:])))
                elif len(parts) == 1:
                    authors.append(ScrapedAuthor(firstname="", lastname=parts[0]))

        # 6. Series & Volume
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
            editor_name="Label 619",
            category_name="Comics",
            page_count=page_count,
            price=price,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Cartonné",
            authors=authors,
            source_url=url
        )
