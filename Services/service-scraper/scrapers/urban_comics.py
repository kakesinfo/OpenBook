import re
import html
import logging
from datetime import datetime
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text

logger = logging.getLogger(__name__)

FRENCH_MONTHS = {
    "janvier": "January", "février": "February", "fevrier": "February",
    "mars": "March", "avril": "April", "mai": "May", "juin": "June",
    "juillet": "July", "août": "August", "aout": "August",
    "septembre": "September", "octobre": "October",
    "novembre": "November", "décembre": "December", "decembre": "December",
    "janv.": "January", "janv": "January",
    "févr.": "February", "févr": "February", "fevr.": "February", "fevr": "February",
    "avr.": "April", "avr": "April",
    "juil.": "July", "juil": "July",
    "sept.": "September", "sept": "September",
    "oct.": "October", "oct": "October",
    "nov.": "November", "nov": "November",
    "déc.": "December", "déc": "December", "dec.": "December", "dec": "December",
}

def parse_french_date(text: str) -> Optional[datetime]:
    if not text:
        return None
    cleaned = text.strip().lower()
    for fr, en in FRENCH_MONTHS.items():
        if fr in cleaned:
            cleaned = cleaned.replace(fr, en)
            break
    try:
        return date_parser.parse(cleaned, fuzzy=True)
    except Exception:
        return None

class UrbanComicsScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "urban_comics"

    def scrape(self, max_items: int = 50, full_scan: bool = False) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        base_shop = "https://www.urban-comics.com/shop/"
        urls_to_visit = [base_shop, "https://www.urban-comics.com/a-paraitre/"]
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        })

        seen_links = set()
        product_links = []

        # If full_scan is enabled, paginate through /shop/page/N/
        max_pages = 100 if full_scan else 3
        current_page = 1

        while current_page <= max_pages:
            list_url = f"{base_shop}page/{current_page}/" if current_page > 1 else base_shop
            if not full_scan and len(product_links) >= max_items:
                break
            try:
                logger.info("UrbanComics: Fetching listing %s", list_url)
                resp = session.get(list_url, timeout=settings.REQUEST_TIMEOUT)
                if resp.status_code == 404:
                    logger.info("UrbanComics: Reached end of catalogue at page %d", current_page)
                    break
                if resp.status_code != 200:
                    break

                page_content = resp.content.decode("utf-8", errors="replace")
                soup = BeautifulSoup(page_content, "html.parser")
                found_on_page = 0
                for li in soup.find_all("li", class_=re.compile(r"product")):
                    a_tag = li.find("a", href=True)
                    if a_tag:
                        href = a_tag["href"]
                        if href not in seen_links and "urban-comics.com" in href:
                            seen_links.add(href)
                            product_links.append(href)
                            found_on_page += 1
                            if not full_scan and len(product_links) >= max_items:
                                break
                
                if found_on_page == 0:
                    break
                current_page += 1
            except Exception as e:
                logger.warning("UrbanComics: error fetching list %s: %s", list_url, e)
                break

        # Also fetch a-paraitre
        try:
            resp_ap = session.get("https://www.urban-comics.com/a-paraitre/", timeout=settings.REQUEST_TIMEOUT)
            if resp_ap.status_code == 200:
                soup_ap = BeautifulSoup(resp_ap.content.decode("utf-8", errors="replace"), "html.parser")
                for li in soup_ap.find_all("li", class_=re.compile(r"product")):
                    a_tag = li.find("a", href=True)
                    if a_tag and a_tag["href"] not in seen_links:
                        seen_links.add(a_tag["href"])
                        product_links.append(a_tag["href"])
        except Exception as e:
            logger.warning("UrbanComics a-paraitre error: %s", e)

        logger.info("UrbanComics: Found %d product pages to scrape", len(product_links))

        for prod_url in product_links:
            try:
                book = self._scrape_product_page(session, prod_url)
                if book:
                    books.append(book)
            except Exception as e:
                logger.error("UrbanComics: error parsing product %s: %s", prod_url, e)

        return books

    def _scrape_product_page(self, session: requests.Session, url: str) -> Optional[ScrapedBook]:
        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        page_content = resp.content.decode("utf-8", errors="replace")
        soup = BeautifulSoup(page_content, "html.parser")

        # 1. Title
        title = None
        h1 = soup.find("h1", class_=re.compile(r"entry-title|product_title"))
        if h1:
            title = h1.get_text(strip=True)
        if not title:
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                title = og_title["content"].split(" - Urban Comics")[0].strip()
        if not title:
            return None

        # Clean title
        title = clean_text(re.sub(r"\s+", " ", title).strip())

        # 2. Extract series and volume from title
        series_name = title
        volume = None
        vol_match = re.search(r"Tome\s*(\d+)", title, re.I)
        if vol_match:
            volume = int(vol_match.group(1))
            series_name = re.sub(r"Tome\s*\d+.*", "", title, flags=re.I).strip(" -:")
        else:
            vol_match2 = re.search(r"T(\d+)", title, re.I)
            if vol_match2:
                volume = int(vol_match2.group(1))
                series_name = re.sub(r"T\d+.*", "", title, flags=re.I).strip(" -:")

        if not series_name:
            series_name = title
        series_name = clean_text(series_name)

        # 3. Extract metadata from <ul> list in page
        isbn = None
        page_count = 0
        price = 0
        release_date = None

        text_content = page_content
        # EAN / ISBN
        ean_match = re.search(r"<b>EAN\s*:</b>\s*([0-9]{10,13})", text_content, re.I)
        if ean_match:
            isbn = ean_match.group(1)

        # Pagination
        page_match = re.search(r"<b>Pagination\s*:</b>\s*([0-9]+)\s*pages", text_content, re.I)
        if page_match:
            page_count = int(page_match.group(1))

        # Price
        price_match = re.search(r"class=[\"'](?:woocommerce-Price-amount amount|price)[\"'][^>]*>([0-9]+)[,\.]([0-9]+)", text_content)
        if price_match:
            price = int(price_match.group(1))

        # Date de sortie
        date_match = re.search(r"<b>Date de sortie\s*:</b>\s*([^<]+)", text_content, re.I)
        if date_match:
            release_date = parse_french_date(date_match.group(1))

        if not release_date:
            release_date = datetime.now()

        # 4. Cover URL
        cover_url = None
        cover_img = soup.find("img", class_=re.compile(r"single-product-cover"))
        if cover_img and cover_img.get("src"):
            cover_url = cover_img["src"]
        elif isbn:
            cover_url = f"https://bdi.dlpdomain.com/album/{isbn}/couv/M385x862/{slug_title(title)}.jpg"

        # 5. Description
        description = None
        desc_div = soup.find("div", class_="entry-content")
        if desc_div:
            p_tags = desc_div.find_all("p")
            desc_texts = [p.get_text(strip=True) for p in p_tags if p.get_text(strip=True)]
            if desc_texts:
                description = clean_text("\n\n".join(desc_texts[:3]))
        if not description:
            og_desc = soup.find("meta", property="og:description")
            if og_desc and og_desc.get("content"):
                description = clean_text(og_desc["content"].strip())

        # 6. Authors
        authors: List[ScrapedAuthor] = []
        for a_link in soup.find_all("a", href=re.compile(r"/auteurs/")):
            author_name = clean_text(a_link.get_text(strip=True))
            if author_name and author_name != "Auteurs":
                parts = author_name.split()
                if len(parts) >= 2:
                    authors.append(ScrapedAuthor(firstname=parts[0], lastname=" ".join(parts[1:]), role="Writer"))
                elif len(parts) == 1:
                    authors.append(ScrapedAuthor(firstname="", lastname=parts[0], role="Writer"))

        return ScrapedBook(
            title=title[:255],
            series_name=series_name[:255],
            volume=volume,
            isbn=isbn,
            editor_name="Urban Comics",
            category_name="Comics",
            page_count=page_count,
            price=price,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Comics",
            authors=authors,
            source_url=url
        )

def slug_title(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s
