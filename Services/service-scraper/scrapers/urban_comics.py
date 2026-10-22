import re
import html
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Dict, Any, Tuple, Set, Callable
import requests
from requests.adapters import HTTPAdapter
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

ALL_MONTH_SLUGS = [
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
]


def parse_french_date(text: Optional[str]) -> Optional[datetime]:
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


def slug_title(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def parse_authors(soup: BeautifulSoup) -> List[ScrapedAuthor]:
    authors: List[ScrapedAuthor] = []
    h5 = soup.find("h5", class_="authors")
    if not h5:
        return authors

    current_role = "Writer"
    for child in h5.children:
        if isinstance(child, str):
            txt = child.strip().lower()
            if any(k in txt for k in ["scénari", "scenar", "auteur", "histoire"]):
                current_role = "Writer"
            elif any(k in txt for k in ["dessin", "illustrat", "artiste"]):
                current_role = "Illustrator"
            elif any(k in txt for k in ["color", "couleur"]):
                current_role = "Colorist"
            elif "traduct" in txt:
                current_role = "Translator"
            elif "encre" in txt:
                current_role = "Inker"
            elif "lettr" in txt:
                current_role = "Letterer"
        elif getattr(child, "name", None) == "a":
            raw_name = clean_text(child.get_text(strip=True))
            if not raw_name or any(noise in raw_name.lower() for noise in ["interview", "portfolio", "auteur", "actualité"]):
                continue
            parts = raw_name.split()
            if len(parts) >= 2:
                fn = parts[0].capitalize()
                ln = " ".join(parts[1:]).title()
                authors.append(ScrapedAuthor(firstname=fn, lastname=ln, role=current_role))
            elif len(parts) == 1:
                authors.append(ScrapedAuthor(firstname="", lastname=parts[0].title(), role=current_role))
    return authors


def parse_description(soup: BeautifulSoup) -> Optional[str]:
    # 1. Main synopsis block inside div.eightcol before other sections
    eight = soup.find("div", class_="eightcol")
    if eight:
        h1 = eight.find(["h1", "h2"])
        desc_parts = []
        start = False
        for el in eight.children:
            if el == h1:
                start = True
                continue
            if start:
                if getattr(el, "name", None) in ["div", "ul", "h5", "h3", "h4", "form", "script"]:
                    break
                t = el.get_text(strip=True) if hasattr(el, "get_text") else str(el).strip()
                if t:
                    desc_parts.append(t)
        full_desc = " ".join(desc_parts).strip()
        if len(full_desc) > 30:
            return clean_text(full_desc)

    # 2. og:description
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        content = og_desc["content"].strip()
        if content:
            return clean_text(content)

    # 3. div.entry-content
    desc_div = soup.find("div", class_="entry-content")
    if desc_div:
        p_tags = desc_div.find_all("p")
        desc_texts = [p.get_text(strip=True) for p in p_tags if p.get_text(strip=True)]
        if desc_texts:
            return clean_text("\n\n".join(desc_texts[:3]))

    return None


def parse_series_and_volume(title: str, soup: BeautifulSoup) -> Tuple[str, Optional[int]]:
    series_name = None
    volume = None

    # 1. Check explicit serie_album container
    serie_div = soup.find("div", class_="serie_album")
    if serie_div:
        a_serie = serie_div.find("a")
        if a_serie and a_serie.get_text(strip=True):
            series_name = a_serie.get_text(strip=True)
        else:
            txt = serie_div.get_text(strip=True)
            series_name = re.sub(r"^S[eé]rie\s*:\s*", "", txt, flags=re.I).strip()

    # 2. Extract volume number
    vol_match = re.search(r"\b(?:Tome|Vol(?:ume)?\.?|T)\s*(\d+)\b", title, re.I)
    if vol_match:
        volume = int(vol_match.group(1))
    else:
        int_match = re.search(r"Int[eé]grale\s*(\d+)", title, re.I)
        if int_match:
            volume = int(int_match.group(1))

    # 3. If series_name not extracted from page container, derive from title
    if not series_name:
        if vol_match:
            series_name = re.sub(r"\b(?:Tome|Vol(?:ume)?\.?|T)\s*\d+.*", "", title, flags=re.I).strip(" -:")
        elif re.search(r"Int[eé]grale", title, re.I):
            series_name = re.sub(r"Int[eé]grale.*", "", title, flags=re.I).strip(" -:")
        else:
            series_name = title

    if not series_name:
        series_name = title

    return clean_text(series_name), volume


class UrbanComicsScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "urban_comics"

    @property
    def display_name(self) -> str:
        return "Urban Comics"

    @property
    def description(self) -> str:
        return "Comics DC, Indies, Urban Link"

    @property
    def color(self) -> str:
        return "#3b82f6"

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        adapter = HTTPAdapter(pool_connections=6, pool_maxsize=6, max_retries=1)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        return session

    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        session = self._create_session()
        targets: Dict[str, Dict[str, Any]] = {}

        logger.info("UrbanComics: Starting crawl (full_scan=%s, max_items=%d)...", full_scan, max_items)

        # 1. Scrape À paraître (base and month-by-month /a-paraitre/<mois>/<annee>/)
        try:
            ap_targets = self._crawl_a_paraitre(session, full_scan=full_scan, is_stopped=is_stopped)
            logger.info("UrbanComics: Found %d items from à paraître", len(ap_targets))
            targets.update(ap_targets)
        except Exception as e:
            logger.warning("UrbanComics: error crawling à paraître: %s", e)

        if is_stopped and is_stopped():
            return []

        # 2. Scrape Shop (frontpage in routine scan, all pages in full scan)
        try:
            shop_targets = self._crawl_shop(session, full_scan=full_scan, is_stopped=is_stopped)
            logger.info("UrbanComics: Found %d items from shop catalogue", len(shop_targets))
            for link, info in shop_targets.items():
                if link not in targets:
                    targets[link] = info
                else:
                    for k, v in info.items():
                        if v and not targets[link].get(k):
                            targets[link][k] = v
        except Exception as e:
            logger.warning("UrbanComics: error crawling shop: %s", e)

        if is_stopped and is_stopped():
            return []

        # 3. Sitemaps discovery to retrieve all historic catalogue titles
        # Discovers all products from sitemaps dynamically with image & title hints
        if full_scan or len(targets) < max_items:
            try:
                sitemap_targets = self._crawl_sitemaps(session, full_scan=full_scan, is_stopped=is_stopped)
                logger.info("UrbanComics: Found %d items from sitemaps", len(sitemap_targets))
                for link, info in sitemap_targets.items():
                    if link not in targets:
                        targets[link] = info
                    else:
                        for k, v in info.items():
                            if v and not targets[link].get(k):
                                targets[link][k] = v
            except Exception as e:
                logger.warning("UrbanComics: error crawling sitemaps: %s", e)

        if is_stopped and is_stopped():
            return []

        total_discovered = len(targets)
        logger.info("UrbanComics: Total unique titles discovered: %d", total_discovered)

        if total_discovered == 0:
            if is_stopped and is_stopped():
                return []
            raise RuntimeError(
                "Impossible de joindre www.urban-comics.com : le serveur web de l'éditeur est actuellement hors ligne ou inaccessible (connexion refusée / code 521)."
            )

        # Determine target list to scrape
        target_list: List[Tuple[str, Dict[str, Any]]] = list(targets.items())
        if not full_scan:
            # In standard scan, preserve all à-paraître upcoming & recent releases first
            ap_items = [item for item in target_list if item[1].get("release_date")]
            other_items = [item for item in target_list if not item[1].get("release_date")]
            remaining_slots = max(0, max_items - len(ap_items))
            target_list = ap_items + other_items[:remaining_slots]
        # In full_scan, we do NOT truncate target_list! All discovered items are scraped.

        # 4. Concurrently fetch and parse product pages with gentle concurrency
        books: List[ScrapedBook] = []
        max_workers = 4  # Gentle concurrency to prevent server overload and timeouts
        logger.info("UrbanComics: Fetching %d detail pages using %d threads...", len(target_list), max_workers)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_url = {
                executor.submit(self._scrape_product_page, session, url, hints): url
                for url, hints in target_list
            }
            for future in as_completed(future_to_url):
                if is_stopped and is_stopped():
                    logger.info("UrbanComics: scraping interrupted by stop signal")
                    executor.shutdown(wait=False, cancel_futures=True)
                    break
                url = future_to_url[future]
                try:
                    book = future.result()
                    if book:
                        books.append(book)
                        if on_book_found:
                            try:
                                on_book_found(book)
                            except Exception as cb_err:
                                logger.warning("UrbanComics: on_book_found error: %s", cb_err)
                except Exception as e:
                    logger.error("UrbanComics: error parsing product %s: %s", url, e)

        logger.info("UrbanComics: Completed scrape. Extracted %d books.", len(books))
        return books

    def _crawl_a_paraitre(
        self,
        session: requests.Session,
        full_scan: bool = False,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Crawls https://www.urban-comics.com/a-paraitre/ and all monthly release archives.
        In full scan, visits all years from 2012 to current_year + 1.
        """
        targets: Dict[str, Dict[str, Any]] = {}
        base_ap_url = "https://www.urban-comics.com/a-paraitre/"

        logger.info("UrbanComics: Fetching base à paraître page: %s", base_ap_url)
        try:
            resp = session.get(base_ap_url, timeout=15)
            if resp.status_code == 200:
                soup_base = BeautifulSoup(resp.content.decode("utf-8", errors="replace"), "html.parser")
                self._extract_comics_containers(soup_base, targets)
        except Exception as e:
            logger.warning("UrbanComics: error fetching base à paraître: %s", e)

        if is_stopped and is_stopped():
            return targets

        now = datetime.now()
        current_year = now.year
        current_month = now.month

        # Build list of (month_slug, year) to crawl
        months_to_visit: List[Tuple[str, int]] = []

        if full_scan:
            # Full catalogue: all months from inception (2012) to next year
            years = list(range(2012, current_year + 2))
            for y in years:
                for m in ALL_MONTH_SLUGS:
                    months_to_visit.append((m, y))
        else:
            # Routine scan window: 3 months past to 9 months ahead (covering PlanningPage window)
            for offset in range(-3, 10):
                target_month_index = (current_month - 1 + offset) % 12
                year_offset = (current_month - 1 + offset) // 12
                target_year = current_year + year_offset
                m_slug = ALL_MONTH_SLUGS[target_month_index]
                months_to_visit.append((m_slug, target_year))

        logger.info("UrbanComics: Fetching %d monthly schedule pages...", len(months_to_visit))

        def fetch_month_page(item: Tuple[str, int]) -> Tuple[Tuple[str, int], Optional[str]]:
            if is_stopped and is_stopped():
                return item, None
            m_slug, year = item
            url = f"https://www.urban-comics.com/a-paraitre/{m_slug}/{year}/"
            try:
                r_month = session.get(url, timeout=12)
                if r_month.status_code == 200:
                    return item, r_month.content.decode("utf-8", errors="replace")
                # Fallback to checklist archive URL for older years
                url_chk = f"https://www.urban-comics.com/checklist/{m_slug}/{year}/"
                r_chk = session.get(url_chk, timeout=12)
                if r_chk.status_code == 200:
                    return item, r_chk.content.decode("utf-8", errors="replace")
            except Exception as e:
                logger.debug("UrbanComics: error fetching month page %s: %s", url, e)
            return item, None

        workers = 4 if full_scan else 6
        with ThreadPoolExecutor(max_workers=workers) as executor:
            results = list(executor.map(fetch_month_page, months_to_visit))

        for (m_slug, year), page_html in results:
            if page_html:
                soup_m = BeautifulSoup(page_html, "html.parser")
                self._extract_comics_containers(soup_m, targets)

        return targets

    def _extract_comics_containers(self, soup: BeautifulSoup, targets: Dict[str, Dict[str, Any]]):
        """Extracts products from div.comics-container cards on à paraître & checklist pages."""
        for container in soup.find_all("div", class_="comics-container"):
            a_tag = container.find("a", href=True)
            if not a_tag:
                continue
            url = a_tag["href"].split("?")[0].rstrip("/") + "/"
            if "urban-comics.com" not in url or any(skip in url for skip in ["/a-paraitre", "/checklist", "/shop", "/category", "/auteurs"]):
                continue

            # 1. Release date in header (e.g. "02 octobre 2026")
            header = container.find("div", class_="comics-container-header")
            rel_date = parse_french_date(header.get_text(strip=True)) if header else None

            # 2. Cover image
            img = container.find("img")
            cover_url = img.get("src") or img.get("data-lazy-src") if img else None

            # 3. Caption data
            caption = container.find("div", class_="caption")
            caption_title = None
            caption_price = None
            if caption:
                h3 = caption.find(["h3", "h5"])
                if h3:
                    caption_title = clean_text(h3.get_text(strip=True))
                price_b = caption.find("div", class_="caption-prix")
                if price_b:
                    p_match = re.search(r"(\d+)", price_b.get_text(strip=True))
                    if p_match:
                        caption_price = int(p_match.group(1))

            if url not in targets:
                targets[url] = {}

            if rel_date and not targets[url].get("release_date"):
                targets[url]["release_date"] = rel_date
            if cover_url and not targets[url].get("cover_url"):
                targets[url]["cover_url"] = cover_url
            if caption_title and not targets[url].get("title"):
                targets[url]["title"] = caption_title
            if caption_price and not targets[url].get("price"):
                targets[url]["price"] = caption_price

    def _crawl_shop(
        self,
        session: requests.Session,
        full_scan: bool = False,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Crawls https://www.urban-comics.com/shop/ catalogue pages.
        In full scan mode, paginates through all available shop pages.
        """
        targets: Dict[str, Dict[str, Any]] = {}
        page = 1
        max_pages = 200 if full_scan else 1

        while page <= max_pages:
            if is_stopped and is_stopped():
                break

            url = "https://www.urban-comics.com/shop/" if page == 1 else f"https://www.urban-comics.com/shop/page/{page}/"
            try:
                resp = session.get(url, timeout=15)
                if resp.status_code != 200:
                    break
            except Exception as e:
                logger.debug("UrbanComics: shop page %s request failed: %s", url, e)
                break

            soup = BeautifulSoup(resp.content.decode("utf-8", errors="replace"), "html.parser")
            found_count = self._extract_shop_cards(soup, targets)
            if found_count == 0:
                break

            # If not full scan, only retrieve frontpage
            if not full_scan:
                break

            page += 1

        return targets

    def _extract_shop_cards(self, soup: BeautifulSoup, targets: Dict[str, Dict[str, Any]]) -> int:
        count = 0
        for tag in soup.find_all(lambda t: t.name in ["li", "div", "article"] and "product" in t.get("class", [])):
            a = tag.find("a", href=True)
            if not a:
                continue
            clean_href = a["href"].split("?")[0].rstrip("/") + "/"
            if "urban-comics.com" not in clean_href or any(skip in clean_href for skip in ["/shop", "/category", "/auteurs", "/tag", "/collection"]):
                continue

            # Title
            title_elem = tag.find(class_=re.compile(r"woocommerce-loop-product__title|product-title|title")) or tag.find(["h2", "h3"])
            title = clean_text(title_elem.get_text(strip=True)) if title_elem else None

            # Cover
            img = tag.find("img")
            cover_url = img.get("src") or img.get("data-lazy-src") or img.get("data-src") if img else None

            # Price
            price = None
            price_elem = tag.find(class_=re.compile(r"price|amount"))
            if price_elem:
                p_match = re.search(r"(\d+)[,\.](\d+)", price_elem.get_text(strip=True))
                if p_match:
                    price = int(p_match.group(1))

            if clean_href not in targets:
                targets[clean_href] = {}
            if title and not targets[clean_href].get("title"):
                targets[clean_href]["title"] = title
            if cover_url and not targets[clean_href].get("cover_url"):
                targets[clean_href]["cover_url"] = cover_url
            if price and not targets[clean_href].get("price"):
                targets[clean_href]["price"] = price
            count += 1
        return count

    def _crawl_sitemaps(
        self,
        session: requests.Session,
        full_scan: bool = False,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Crawls Yoast SEO / WordPress XML sitemaps to discover all catalogue items.
        Extracts loc, image:loc, image:title, and lastmod directly from XML.
        """
        targets: Dict[str, Dict[str, Any]] = {}
        sitemaps_to_crawl: List[str] = []

        # 1. Discover sub-sitemaps from sitemap_index.xml or wp-sitemap.xml
        for idx_url in ["https://www.urban-comics.com/sitemap_index.xml", "https://www.urban-comics.com/wp-sitemap.xml"]:
            if is_stopped and is_stopped():
                break
            try:
                r = session.get(idx_url, timeout=15)
                if r.status_code == 200:
                    root = ET.fromstring(r.content)
                    for child in root:
                        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                        if tag == "sitemap":
                            for elem in child:
                                el_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                                if el_tag == "loc" and elem.text:
                                    loc_text = elem.text.strip()
                                    if any(k in loc_text for k in ["product", "album", "post", "comic"]):
                                        if not any(skip in loc_text for skip in ["category", "tag", "author", "collection"]):
                                            if loc_text not in sitemaps_to_crawl:
                                                sitemaps_to_crawl.append(loc_text)
                    if sitemaps_to_crawl:
                        break
            except Exception as e:
                logger.debug("UrbanComics: error parsing sitemap index %s: %s", idx_url, e)

        # Fallback list if sitemap_index failed or in standard scan
        if not sitemaps_to_crawl:
            sitemaps_to_crawl = [
                "https://www.urban-comics.com/product-sitemap3.xml",
                "https://www.urban-comics.com/product-sitemap2.xml",
                "https://www.urban-comics.com/product-sitemap1.xml",
                "https://www.urban-comics.com/product-sitemap.xml",
                "https://www.urban-comics.com/product-sitemap4.xml",
                "https://www.urban-comics.com/product-sitemap5.xml",
                "https://www.urban-comics.com/post-sitemap1.xml",
                "https://www.urban-comics.com/post-sitemap2.xml",
                "https://www.urban-comics.com/post-sitemap3.xml"
            ]

        if not full_scan:
            # Routine scan: inspect only the most recent product sitemaps
            sitemaps_to_crawl = [s for s in sitemaps_to_crawl if any(k in s for k in ["sitemap3", "sitemap2"])][:2]
            if not sitemaps_to_crawl:
                sitemaps_to_crawl = ["https://www.urban-comics.com/product-sitemap3.xml"]

        logger.info("UrbanComics: Crawling %d XML sitemaps...", len(sitemaps_to_crawl))

        for sm_url in sitemaps_to_crawl:
            if is_stopped and is_stopped():
                break
            try:
                r = session.get(sm_url, timeout=15)
                if r.status_code != 200:
                    continue
                root = ET.fromstring(r.content)
                for url_elem in root:
                    tag = url_elem.tag.split("}")[-1] if "}" in url_elem.tag else url_elem.tag
                    if tag != "url":
                        continue
                    loc, lastmod, img_url, img_title = None, None, None, None
                    for child in url_elem:
                        c_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                        if c_tag == "loc":
                            loc = child.text.strip() if child.text else None
                        elif c_tag == "lastmod":
                            lastmod = child.text.strip() if child.text else None
                        elif c_tag == "image":
                            for img_child in child:
                                ic_tag = img_child.tag.split("}")[-1] if "}" in img_child.tag else img_child.tag
                                if ic_tag == "loc":
                                    img_url = img_child.text.strip() if img_child.text else None
                                elif ic_tag == "title":
                                    img_title = img_child.text.strip() if img_child.text else None

                    if not loc:
                        continue
                    clean_url = loc.split("?")[0].rstrip("/") + "/"
                    if "urban-comics.com" not in clean_url:
                        continue
                    if any(skip in clean_url for skip in ["/shop", "/category", "/auteurs", "/tag", "/collection", "/a-paraitre", "/checklist"]):
                        continue

                    if clean_url not in targets:
                        targets[clean_url] = {}
                    if img_title and not targets[clean_url].get("title"):
                        targets[clean_url]["title"] = img_title
                    if img_url and not targets[clean_url].get("cover_url"):
                        targets[clean_url]["cover_url"] = img_url
                    if lastmod and not targets[clean_url].get("release_date"):
                        parsed_lm = parse_french_date(lastmod[:10])
                        if parsed_lm:
                            targets[clean_url]["release_date"] = parsed_lm
            except Exception as e:
                logger.debug("UrbanComics: error parsing sitemap %s: %s", sm_url, e)

        return targets

    def _scrape_product_page(
        self,
        session: requests.Session,
        url: str,
        hints: Optional[Dict[str, Any]] = None
    ) -> Optional[ScrapedBook]:
        hints = hints or {}
        resp = None
        try:
            resp = session.get(url, timeout=12)
        except Exception as e:
            logger.debug("UrbanComics: request failed for %s: %s", url, e)

        if not resp or resp.status_code != 200:
            # Fallback to hints if product page times out or fails
            slug = url.strip("/").split("/")[-1]
            if any(skip in slug for skip in ["shop", "category", "auteurs", "tag", "collection", "cart", "mon-compte"]):
                return None
            fallback_title = hints.get("title") or slug.replace("-", " ").title()
            if not fallback_title or len(fallback_title) < 2:
                return None
            series_name, volume = parse_series_and_volume(fallback_title, BeautifulSoup("", "html.parser"))
            return ScrapedBook(
                title=clean_text(fallback_title)[:255],
                series_name=clean_text(series_name)[:255],
                volume=volume or 1,
                isbn=hints.get("isbn"),
                editor_name="Urban Comics",
                category_name="Comics",
                page_count=0,
                price=hints.get("price", 0) or 0,
                description=None,
                cover_url=hints.get("cover_url"),
                release_date=hints.get("release_date") or datetime.now(),
                book_type="Comics",
                authors=[],
                source_url=url
            )

        page_content = resp.content.decode("utf-8", errors="replace")
        soup = BeautifulSoup(page_content, "html.parser")

        # 1. Title
        title = None
        h1 = soup.find(id="titre-album") or soup.find("h1", class_=re.compile(r"product_title|entry-title")) or soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
        if not title:
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                title = og_title["content"].split(" - Urban Comics")[0].strip()
        if not title:
            title = hints.get("title")

        if not title:
            slug = url.strip("/").split("/")[-1]
            if any(skip in slug for skip in ["shop", "category", "auteurs", "tag", "collection"]):
                return None
            title = slug.replace("-", " ").title()

        title = clean_text(re.sub(r"\s+", " ", title).strip())

        # 2. Series & Volume
        series_name, volume = parse_series_and_volume(title, soup)

        # 3. Metadata from text & lists
        isbn = hints.get("isbn")
        page_count = 0
        price = hints.get("price", 0) or 0
        release_date = hints.get("release_date")

        # EAN / ISBN
        ean_match = re.search(r"<b>(?:EAN|ISBN)\s*:</b>\s*([0-9]{10,13})", page_content, re.I)
        if ean_match:
            isbn = ean_match.group(1)
        elif not isbn:
            data_ean = soup.find(attrs={"data-ean": True})
            if data_ean:
                isbn = data_ean["data-ean"]
            else:
                img_ean = re.search(r"/album/([0-9]{10,13})/", page_content)
                if img_ean:
                    isbn = img_ean.group(1)

        # Pagination
        page_match = re.search(r"<b>Pagination\s*:</b>\s*([0-9]+)\s*page", page_content, re.I)
        if page_match:
            page_count = int(page_match.group(1))

        # Price
        price_match = re.search(r"class=[\"'](?:woocommerce-Price-amount amount|price)[\"'][^>]*>([0-9]+)[,\.]([0-9]+)", page_content)
        if price_match:
            price = int(price_match.group(1))
        elif price == 0:
            raw_p = re.search(r"Prix\s*:\s*([0-9]+)[,\.]([0-9]+)", page_content)
            if raw_p:
                price = int(raw_p.group(1))

        # Release date
        date_match = re.search(r"<b>Date de sortie\s*:</b>\s*([^<]+)", page_content, re.I)
        if date_match:
            parsed_d = parse_french_date(date_match.group(1))
            if parsed_d:
                release_date = parsed_d

        if not release_date:
            release_date = datetime.now()

        # 4. Cover URL
        cover_url = hints.get("cover_url")
        cover_img = soup.find("img", class_=re.compile(r"single-product-cover"))
        if cover_img and cover_img.get("src"):
            cover_url = cover_img["src"]
        elif not cover_url:
            og_img = soup.find("meta", property="og:image")
            if og_img and og_img.get("content"):
                cover_url = og_img["content"]
            elif isbn:
                cover_url = f"https://bdi.dlpdomain.com/album/{isbn}/couv/M385x862/{slug_title(title)}.jpg"

        # 5. Description
        description = parse_description(soup)

        # 6. Authors
        authors = parse_authors(soup)

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
