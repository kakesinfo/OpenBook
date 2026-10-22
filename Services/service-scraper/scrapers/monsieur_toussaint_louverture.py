import re
import html
import logging
from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
import requests
from bs4 import BeautifulSoup

from config import settings
from scrapers.base import BaseScraper, ScrapedBook, ScrapedAuthor, clean_text, clean_author_name, split_author_name
from scrapers.urban_comics import parse_french_date

logger = logging.getLogger(__name__)

ROMAN_NUMS = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10
}

FRENCH_ORDINALS = {
    "premier": 1, "premiere": 1, "première": 1,
    "deuxieme": 2, "deuxième": 2, "second": 2, "seconde": 2,
    "troisieme": 3, "troisième": 3,
    "quatrieme": 4, "quatrième": 4,
    "cinquieme": 5, "cinquième": 5,
}

OBJET_KEYWORDS = [
    "sérigraphie", "serigraphie", "carnet", "tasse", "t-shirt", "affiche",
    "badge", "marque-page", "miniature", "(vide)", " vide", "tote bag", "ex-libris"
]

EPUB_KEYWORDS = [
    "/ epub", "epub", "e-book", "ebook", "livre numérique", "livres numériques"
]


def parse_series_and_volume(title: str):
    """
    Extracts series name and volume number from a Monsieur Toussaint Louverture title.
    Examples:
      - 'Blackwater I, La Crue – L’épique saga de la famille Caskey' -> ('Blackwater', 1)
      - 'Blackwater IV, La Guerre – L’épique saga de la famille Caskey' -> ('Blackwater', 4)
      - 'L’Heure du loup – Volume 1' -> ('L’Heure du loup', 1)
      - 'MIND MGMT – Rapport d’opérations 1/3' -> ('MIND MGMT', 1)
      - 'Moi, ce que j’aime, c’est les monstres – Livre deuxième' -> ('Moi, ce que j’aime, c’est les monstres', 2)
      - 'Les Élémentaires' -> ('Les Élémentaires', None)
    """
    volume = None
    series_name = title

    # 1. Volume X, Tome X, T X
    m_vol = re.search(r"[\s–\-]+(?:Volume|Tome|T\.?)\s*0?(\d+)", title, re.I)
    if m_vol:
        volume = int(m_vol.group(1))
        series_name = title[:m_vol.start()].strip(" –-:,")
        return series_name, volume

    # 2. Fractions (e.g. 1/3, 2/3)
    m_frac = re.search(r"[\s–\-]+.*?(\d+)\s*/\s*\d+", title)
    if m_frac:
        volume = int(m_frac.group(1))
        m_s = re.search(r"^(.*?)(?:[\s–\-]+Rapport|[\s–\-]+\d+\s*/)", title)
        if m_s:
            series_name = m_s.group(1).strip(" –-:,")
        return series_name, volume

    # 3. Known roman numeral series: 'Blackwater I', 'Swan Song II'
    m_rom = re.search(r"\b(Blackwater|Swan Song)\s+([IVX]+)\b", title, re.I)
    if m_rom:
        series_name = m_rom.group(1)
        rom = m_rom.group(2).lower()
        volume = ROMAN_NUMS.get(rom)
        return series_name, volume

    # 4. French ordinals: 'Livre premier', 'Livre deuxième'
    m_ord = re.search(r"[\s–\-]+Livre\s+(premier|premi[eè]re|deuxi[eè]me|second|seconde|troisi[eè]me|quatri[eè]me|\d+)", title, re.I)
    if m_ord:
        val = m_ord.group(1).lower()
        volume = FRENCH_ORDINALS.get(val, int(val) if val.isdigit() else None)
        series_name = title[:m_ord.start()].strip(" –-:,")
        return series_name, volume

    return series_name, volume


class MonsieurToussaintLouvertureScraper(BaseScraper):
    @property
    def name(self) -> str:
        return "monsieur_toussaint_louverture"

    @property
    def display_name(self) -> str:
        return "Monsieur Toussaint Louverture"

    @property
    def description(self) -> str:
        return "Romans, littératures de l'imaginaire, aventures et romans graphiques (Blackwater, McCammon, etc.)"

    @property
    def color(self) -> str:
        return "#d97706"

    # Only scrape the 6 authorized collections, explicitly excluding Livres numériques & Objets
    COLLECTIONS = [
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/bibliotheque-mccammon/",
            "collection": "Bibliothèque McCammon",
            "category": "Roman"
        },
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-romans/",
            "collection": "Grands Romans",
            "category": "Roman"
        },
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/monsieur-toussaint-laventure/",
            "collection": "Monsieur Toussaint Laventure",
            "category": "Roman"
        },
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/blackwater/",
            "collection": "Bibliothèque McDowell",
            "category": "Roman"
        },
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-animaux/",
            "collection": "Les Grands Animaux",
            "category": "Roman"
        },
        {
            "url": "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/romans-graphiques/",
            "collection": "Romans Graphiques",
            "category": "Roman Graphique"
        },
    ]

    def scrape(
        self,
        max_items: int = 50,
        full_scan: bool = False,
        on_book_found: Optional[Callable[[ScrapedBook], None]] = None,
        is_stopped: Optional[Callable[[], bool]] = None
    ) -> List[ScrapedBook]:
        books: List[ScrapedBook] = []
        session = requests.Session()
        session.headers.update({
            "User-Agent": settings.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        })

        seen_urls = set()
        product_entries: List[Dict[str, str]] = []

        logger.info(
            "MTL: Gathering books from 6 authorized boutique collections (full_scan=%s, max_items=%d)...",
            full_scan,
            max_items
        )

        for col_info in self.COLLECTIONS:
            if is_stopped and is_stopped():
                break
            if not full_scan and len(product_entries) >= max_items:
                break

            base_cat_url = col_info["url"]
            cat_default = col_info["category"]
            page = 1

            while True:
                if is_stopped and is_stopped():
                    break
                if not full_scan and len(product_entries) >= max_items:
                    break

                page_url = base_cat_url if page == 1 else f"{base_cat_url.rstrip('/')}/page/{page}/"
                try:
                    resp = session.get(page_url, timeout=settings.REQUEST_TIMEOUT)
                except Exception as e:
                    logger.warning("MTL: Error fetching %s: %s", page_url, e)
                    break

                if resp.status_code != 200:
                    break

                soup = BeautifulSoup(resp.text, "html.parser")
                product_cards = soup.find_all(class_=lambda c: c and "product" in c.split())
                if not product_cards:
                    break

                found_on_page = 0
                for card in product_cards:
                    if is_stopped and is_stopped():
                        break

                    a_tag = card.find("a", href=True)
                    if not a_tag:
                        continue

                    href = a_tag["href"].split("?")[0].rstrip("/") + "/"
                    if "/produit/" not in href or href in seen_urls:
                        continue

                    # Card title / text check to exclude Objets and Epubs early
                    card_text = card.get_text(" ", strip=True).lower()
                    if any(k in card_text for k in OBJET_KEYWORDS) or any(k in href for k in ["objets", "coffret-lheure-du-loup-vide"]):
                        continue
                    if any(k in card_text for k in ["/ epub", "livre numérique", "livres numériques"]) or "/epub" in href:
                        continue

                    seen_urls.add(href)
                    product_entries.append({
                        "url": href,
                        "category": cat_default,
                    })
                    found_on_page += 1

                    if not full_scan and len(product_entries) >= max_items:
                        break

                # If pagination has next page
                has_next = soup.find("a", class_=lambda c: c and "next" in c)
                if not has_next or found_on_page == 0:
                    break
                page += 1

        logger.info("MTL: Found %d product URLs to process", len(product_entries))

        for entry in product_entries:
            if is_stopped and is_stopped():
                logger.info("MTL: Stop requested, halting scrape.")
                break

            prod_url = entry["url"]
            try:
                book = self._scrape_book_page(session, prod_url, entry["category"])
                if book:
                    books.append(book)
                    if on_book_found:
                        try:
                            on_book_found(book)
                        except Exception as cb_err:
                            logger.warning("MTL: on_book_found error: %s", cb_err)

                    if not full_scan and len(books) >= max_items:
                        logger.info("MTL: Reached max_items (%d), stopping scan.", max_items)
                        break
            except Exception as e:
                logger.error("MTL: Error scraping %s: %s", prod_url, e)

        logger.info("MTL: Finished scrape, collected %d books", len(books))
        return books

    def _scrape_book_page(self, session: requests.Session, url: str, default_category: str) -> Optional[ScrapedBook]:
        resp = session.get(url, timeout=settings.REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        page_text = soup.get_text()

        # 1. Product Meta check (Categories / Tags)
        meta = soup.find("div", class_="product_meta")
        meta_text = meta.get_text(" ", strip=True) if meta else ""
        meta_lower = meta_text.lower()

        # Strict exclusion of Livres numériques and Objets
        if "objets" in meta_lower or "livres numériques" in meta_lower or "epub" in meta_lower:
            return None

        # 2. Title
        h1 = soup.find("h1", class_="product_title")
        if not h1:
            h1 = soup.find("h1")
        if not h1:
            return None

        title = clean_text(h1.get_text(strip=True))
        if not title or title.lower().startswith("oooops"):
            return None

        title_lower = title.lower()
        if any(k in title_lower for k in OBJET_KEYWORDS) or any(k in title_lower for k in ["/ epub", "/ ePub", "livre numérique"]):
            return None

        # 3. EAN / ISBN (mandatory for real books)
        ean = None
        m_ean = re.search(r"EAN\s*:\s*([0-9]{13})", meta_text)
        if m_ean:
            ean = m_ean.group(1)
        else:
            m_isbn = re.search(r"\b(97[89][0-9]{10})\b", page_text)
            if m_isbn:
                ean = m_isbn.group(1)

        # Skip products without a valid book EAN
        if not ean:
            return None

        # 4. Author
        authors: List[ScrapedAuthor] = []
        author_name = None

        sub = soup.find("div", class_="mtl-product-subtitle")
        if sub:
            raw_sub = sub.get_text(strip=True)
            # Remove suffixes like "– Édition limitée Créature"
            author_str = re.sub(r"[\s–\-]+(?:[ée]dition|collection).*", "", raw_sub, flags=re.I).strip()
            if author_str and not any(k in author_str.lower() for k in ["toussaint", "livre", "tome", "volume"]):
                author_name = author_str

        if not author_name:
            m_author = re.search(r"(?:Écrit et dessiné|Écrit|Roman de|Un roman de)\s+par\s+([^.,\n\r]+)", page_text, re.I)
            if m_author:
                author_name = m_author.group(1).strip()

        if author_name:
            cleaned_author = clean_author_name(author_name)
            fn, ln = split_author_name(cleaned_author)
            if ln:
                authors.append(ScrapedAuthor(firstname=fn, lastname=ln, role="Writer"))

        # 5. Price
        price = 0
        price_tag = soup.find("div", class_="price-wrapper") or soup.find("p", class_="price")
        if price_tag:
            m_pr = re.search(r"(\d+)(?:[,\.]\d+)?", price_tag.get_text())
            if m_pr:
                price = int(m_pr.group(1))

        # 6. Page count
        page_count = 0
        m_spec = re.search(r"(\d+)\s*pages(?:\s+couleurs?)?\.?\s*(?:Format|\d+\s*x\s*\d+|Couverture|Prix|\.)", resp.text, re.I)
        if m_spec:
            page_count = int(m_spec.group(1))
        else:
            m_all_pages = [int(p) for p in re.findall(r"(\d{2,4})\s*pages", page_text, re.I) if int(p) >= 40]
            if m_all_pages:
                page_count = m_all_pages[0]

        # 7. Release date
        release_date = None
        m_date = re.search(r"Date de (?:parution|publication)\s*[:\s]+\s*([0-9]{1,2}\s+[a-zà-ÿ]+\s+[0-9]{4})", page_text, re.I)
        if m_date:
            release_date = parse_french_date(m_date.group(1).strip())
        if not release_date:
            m_yr = re.search(r"\b(20[12][0-9])\b", page_text)
            if m_yr:
                try:
                    release_date = datetime(int(m_yr.group(1)), 1, 1)
                except Exception:
                    pass
        if not release_date:
            release_date = datetime.now()

        # 8. Description
        description = None
        short_desc = soup.find("div", class_="product-short-description")
        if short_desc:
            t = clean_text(short_desc.get_text(strip=True))
            if len(t) > 30:
                description = t

        if not description:
            desc_panel = soup.find("div", class_=lambda c: c and "woocommerce-Tabs-panel--description" in c)
            if desc_panel:
                for p in desc_panel.find_all("p"):
                    t = clean_text(p.get_text(strip=True))
                    if len(t) > 60 and not any(k in t.lower() for k in ["cookie", "newsletter", "harmonia mundi"]):
                        description = t
                        break

        if not description:
            description = f"Ouvrage Monsieur Toussaint Louverture : {title}"

        # 9. Cover Image URL
        cover_url = None
        img_div = soup.find("div", class_="woocommerce-product-gallery__image")
        if img_div:
            a_img = img_div.find("a")
            if a_img and a_img.get("href"):
                cover_url = a_img["href"]
            elif img_div.find("img"):
                cover_url = img_div.find("img").get("src")
        if not cover_url:
            img_tag = soup.find("img", class_=lambda c: c and "wp-post-image" in c)
            if img_tag:
                cover_url = img_tag.get("src")

        # 10. Series & Volume
        series_name, volume = parse_series_and_volume(title)

        # 11. Category & Book Type
        cat_name = default_category
        if "bandes dessinées" in meta_lower or "roman graphique" in meta_lower:
            cat_name = "Roman Graphique"
            book_type = "Roman Graphique"
        else:
            book_type = "Roman"

        return ScrapedBook(
            title=title[:255],
            series_name=(series_name or title)[:255],
            volume=volume,
            isbn=ean,
            editor_name="Monsieur Toussaint Louverture",
            category_name=cat_name,
            page_count=page_count,
            price=price,
            description=description,
            cover_url=cover_url,
            release_date=release_date,
            book_type=book_type,
            authors=authors,
            source_url=url
        )
