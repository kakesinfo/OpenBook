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
from scrapers.urban_comics import parse_french_date

logger = logging.getLogger(__name__)

class BubbleBDScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "bubble_bd"

    def scrape(self, max_items: int = 50, full_scan: bool = False) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        urls_to_visit = [
            ("https://www.bubblebd.com/list/categories/comics?cids=ABeg4Im9DS", "Comics"),
            ("https://www.bubblebd.com/list/categories/bd?cids=UO3SJTNYON", "Bande dessinée")
        ]

        if full_scan:
            urls_to_visit.append(("https://www.bubblebd.com/agenda", "Bande dessinée"))

        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Linux"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
        })

        album_links = []
        for cat_url, default_cat in urls_to_visit:
            if not full_scan and len(album_links) >= max_items:
                break
            try:
                logger.info("BubbleBD: Fetching listing %s", cat_url)
                resp = session.get(cat_url, timeout=settings.REQUEST_TIMEOUT)
                if resp.status_code != 200:
                    logger.warning("BubbleBD returned HTTP %s for %s", resp.status_code, cat_url)
                    continue

                page_text = resp.content.decode("utf-8", errors="replace")
                # Find album links: /slug/album/seriesId/albumId
                matches = re.findall(r"(/[a-z0-9\-]+/album/[a-zA-Z0-9]+/[a-zA-Z0-9]+)", page_text)
                for rel_path in set(matches):
                    full_url = f"https://www.bubblebd.com{rel_path}"
                    if full_url not in [l[0] for l in album_links]:
                        album_links.append((full_url, default_cat))
                        if not full_scan and len(album_links) >= max_items:
                            break
            except Exception as e:
                logger.error("BubbleBD: error loading %s: %s", cat_url, e)

        logger.info("BubbleBD: Found %d album links to scrape", len(album_links))

        for full_url, default_cat in album_links:
            try:
                book = self._scrape_album_page(session, full_url, default_cat)
                if book:
                    books.append(book)
            except Exception as e:
                logger.error("BubbleBD: error scraping album %s: %s", full_url, e)

        return books

    def _scrape_album_page(self, session: requests.Session, url: str, default_cat: str) -> Optional[ScrapedBook]:
        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        page_content = resp.content.decode("utf-8", errors="replace")

        # 1. Title
        title = None
        og_title = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']', page_content)
        if og_title:
            title = og_title.group(1).strip()
        if not title:
            m_title = re.search(r"<title>([^<]+)</title>", page_content)
            if m_title:
                title = m_title.group(1).split(" | ")[0].strip()

        if not title:
            return None

        # Clean title
        title = clean_text(title)

        # 2. ISBN
        isbn = None
        m_isbn = re.search(r'<meta\s+property=["\']book:isbn["\']\s+content=["\']([0-9]{10,13})["\']', page_content)
        if m_isbn:
            isbn = m_isbn.group(1)
        else:
            m_isbn2 = re.search(r'["\']isbn["\']\s*:\s*["\']([0-9]{10,13})["\']', page_content)
            if m_isbn2:
                isbn = m_isbn2.group(1)

        # 3. Cover Image
        cover_url = None
        m_img = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', page_content)
        if m_img:
            cover_url = m_img.group(1)

        # 4. Description
        description = None
        m_desc = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']', page_content)
        if m_desc:
            description = clean_text(m_desc.group(1))

        # 5. Publisher / Éditeur
        editor_name = "Bubble Editions"
        m_pub = re.search(r'["\']publisher["\']\s*:\s*\{[^}]*["\']name["\']\s*:\s*["\']([^"\']+)["\']', page_content)
        if m_pub:
            editor_name = clean_text(m_pub.group(1))
        else:
            m_pub2 = re.search(r'Éditeur\s*:\s*<[^>]+>([^<]+)<', page_content, re.I)
            if m_pub2:
                editor_name = clean_text(m_pub2.group(1))

        # 6. Pages
        page_count = 0
        m_pages = re.search(r'["\']numberOfPages["\']\s*:\s*([0-9]+)', page_content)
        if m_pages:
            page_count = int(m_pages.group(1))

        # 7. Release date
        release_date = None
        m_date = re.search(r'["\']publicationDate["\']\s*[:,]\s*["\']([^"\']+)["\']', page_content)
        if m_date:
            try:
                release_date = date_parser.isoparse(m_date.group(1))
            except Exception:
                pass
        if not release_date:
            m_html_date = re.search(r'Date de parution</div><div>([^<]+)</div>', page_content, re.I)
            if m_html_date:
                try:
                    release_date = parse_french_date(m_html_date.group(1)) or date_parser.parse(m_html_date.group(1), fuzzy=True)
                except Exception:
                    pass
        if not release_date:
            m_date_any = re.search(r'(\d{1,2}\s+(?:janv|f[ée]vr|mars|avr|mai|juin|juil|ao[ûu]t|sept|oct|nov|d[ée]c)[a-z]*\.?\s+\d{4})', page_content, re.I)
            if m_date_any:
                try:
                    release_date = parse_french_date(m_date_any.group(1)) or date_parser.parse(m_date_any.group(1), fuzzy=True)
                except Exception:
                    pass

        # 8. Series & Volume
        series_name = title
        volume = None
        vol_m = re.search(r"tome\s*(\d+)", title, re.I)
        if vol_m:
            volume = int(vol_m.group(1))
            series_name = re.sub(r"tome\s*\d+.*", "", title, flags=re.I).strip(" -:")
        elif re.search(r"T(\d+)", title):
            vol_m = re.search(r"T(\d+)", title)
            volume = int(vol_m.group(1))
            series_name = re.sub(r"T\d+.*", "", title).strip(" -:")

        if not series_name:
            series_name = title
        series_name = clean_text(series_name)

        # 9. Authors
        authors: List[ScrapedAuthor] = []
        for m_author in re.findall(r'<meta\s+property=["\']book:author["\']\s+content=["\']https://www\.bubblebd\.com/([^/]+)/author/', page_content):
            author_slug = clean_text(m_author.replace("-", " ").title())
            parts = author_slug.split()
            if len(parts) >= 2:
                authors.append(ScrapedAuthor(firstname=parts[0], lastname=" ".join(parts[1:]), role="Writer"))
            elif len(parts) == 1:
                authors.append(ScrapedAuthor(firstname="", lastname=parts[0], role="Writer"))

        return ScrapedBook(
            title=title[:255],
            series_name=series_name[:255],
            volume=volume,
            isbn=isbn,
            editor_name=editor_name[:255],
            category_name=default_cat,
            page_count=page_count,
            price=0,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type="Cartonné" if default_cat == "Bande dessinée" else "Comics",
            authors=authors,
            source_url=url
        )
