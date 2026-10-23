import html
import logging
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

from scrapers.base import (
    ScrapedAuthor,
    clean_text,
    is_variant_title,
    strip_variant_suffix,
    extract_canonical_series_and_volume
)

logger = logging.getLogger(__name__)

BNF_SRU_BASE_URL = "https://catalogue.bnf.fr/api/SRU"
BNF_USER_AGENT = "YetAnotherLibrary/1.0 (https://github.com/yet-another-library)"

def clean_publisher_for_cql(editor_name: Optional[str]) -> Optional[str]:
    if not editor_name:
        return None
    ed = editor_name.strip()
    low = ed.lower()
    if "panini" in low:
        return "Panini"
    if "urban" in low:
        return "Urban"
    if "mangetsu" in low:
        return "Mangetsu"
    if "morgen" in low:
        return "Morgen"
    if "label" in low or "619" in low:
        return "619"
    if "toussaint" in low or "louverture" in low:
        return "Toussaint"
    # General cleanup
    ed = re.sub(r"\b(?:comics|éditions|editions|manga|bd|publishing|presse)\b", "", ed, flags=re.I).strip(" -:")
    return ed if ed else None

def clean_title_for_cql(text: str) -> str:
    cleaned = clean_text(text) or ""
    # Strip quotes and special CQL characters
    cleaned = re.sub(r'[\"\(\)\{\}\[\]\:\-\<\>\=\/\\]', ' ', cleaned)
    return ' '.join(cleaned.split())

def parse_bnf_creator(raw: str) -> Tuple[str, str, str]:
    """Parses BNF creator string 'Lastname, Firstname (dates) [role]' into (firstname, lastname, role)."""
    raw_clean = clean_text(raw) or ""
    role = "Writer"
    lower = raw_clean.lower()
    if "illustrat" in lower or "dessin" in lower:
        role = "Illustrator"
    elif "coloris" in lower:
        role = "Colorist"
    elif "traduct" in lower:
        role = "Translator"

    # Remove dates and role qualifiers in parentheses or after dots
    cleaned = re.sub(
        r'[\.\s]*(?:\((?:auteur|illustrateur|coloriste|traducteur|directeur)[^\)]*\)|\b(?:auteur|illustrateur|coloriste|traducteur)(?:\s+du\s+texte)?\b)[\.\s]*',
        '',
        raw_clean,
        flags=re.I
    )
    cleaned = re.sub(r'\(\s*[\d\.]{2,4}\s*-[^\)]*\)', '', cleaned)
    cleaned = re.sub(r'[\.\s]*\b(?:fonction\s+indéterminée|collaborateur\s+au\s+texte|préfacier|directeur\s+de\s+publication)\b.*', '', cleaned, flags=re.I)
    cleaned = cleaned.strip(" .,;:-")

    parts = cleaned.split(",", 1)
    if len(parts) == 2:
        last = parts[0].strip()
        first = parts[1].strip()
    else:
        first, last = "", cleaned.strip()

    first = re.sub(r'\(\s*[\d\.]{2,4}\s*-[^\)]*\)', '', first)
    first = re.sub(r'[\.\s]*\b(?:fonction\s+indéterminée|collaborateur\s+au\s+texte)\b.*', '', first, flags=re.I)
    first = first.strip(" .,;:-")
    last = last.strip(" .,;:-")

    return first, last, role

def parse_bnf_page_count(format_str: Optional[str]) -> Optional[int]:
    if not format_str:
        return None
    m = re.search(r'\[?(?:ca\s*)?(\d{2,4})\]?\s*p(?:ages?)?\.?\b', format_str, re.I)
    return int(m.group(1)) if m else None

def parse_bnf_collection(desc_str: Optional[str]) -> Optional[str]:
    if not desc_str:
        return None
    m = re.search(r'Collection\s*:\s*([^;,\n]+)', desc_str, re.I)
    if not m:
        return None
    col = clean_text(m.group(1)).strip(" .")
    if "." in col:
        parts = [p.strip() for p in col.split(".") if p.strip()]
        if len(parts) > 1:
            col = parts[-1]
    return col

def parse_bnf_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    cleaned = date_str.strip()
    m = re.search(r'\b(19\d{2}|20\d{2})\b', cleaned)
    if m:
        year = int(m.group(1))
        m_full = re.search(r'(\d{4})-(\d{2})-(\d{2})', cleaned)
        if m_full:
            try:
                return datetime(int(m_full.group(1)), int(m_full.group(2)), int(m_full.group(3)))
            except ValueError:
                pass
        return datetime(year, 1, 1)
    return None

def extract_bnf_volume(title: str) -> Optional[int]:
    """Extracts volume number from BNF title string."""
    m = re.search(r'(?:[\.\s,]+0?(\d+)|t(?:ome)?\s*0?(\d+)|vol(?:ume)?\s*0?(\d+)|n°\s*0?(\d+)|\[(\d+)\])', title, re.I)
    if m:
        for g in m.groups():
            if g:
                return int(g)
    return None

def search_bnf_book(
    title: str,
    series_name: Optional[str] = None,
    editor_name: Optional[str] = None,
    volume: Optional[int] = None,
    is_variant: bool = False,
    timeout: int = 8
) -> Optional[Dict[str, Any]]:
    """
    Queries BNF SRU catalog API and returns best matched metadata for the book.
    Returns None if no matching record is found with sufficient confidence.
    """
    base_title = series_name or extract_canonical_series_and_volume(title)[0] or strip_variant_suffix(title)
    clean_title = clean_title_for_cql(base_title)
    if not clean_title:
        clean_title = clean_title_for_cql(title)
    if not clean_title:
        return None

    publisher_term = clean_publisher_for_cql(editor_name)

    queries = []
    if publisher_term:
        queries.append(f'(bib.title all "{clean_title}") and (bib.publisher all "{publisher_term}")')
    queries.append(f'(bib.title all "{clean_title}")')

    records_xml = None
    ns = {
        'srw': 'http://www.loc.gov/zing/srw/',
        'oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
        'dc': 'http://purl.org/dc/elements/1.1/'
    }

    for q in queries:
        url = (
            f"{BNF_SRU_BASE_URL}?version=1.2&operation=searchRetrieve&recordSchema=dublincore"
            f"&maximumRecords=25&query={urllib.parse.quote(q)}"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": BNF_USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                xml_data = resp.read()
            root = ET.fromstring(xml_data)
            records = root.findall('.//srw:record', ns)
            if records:
                records_xml = records
                break
        except Exception as e:
            logger.warning("BNF SRU query failed for '%s': %s", q, e)
            continue

    if not records_xml:
        return None

    candidates = []
    for rec in records_xml:
        dc = rec.find('.//oai_dc:dc', ns)
        if dc is None:
            continue

        bnf_title = clean_text(dc.findtext('dc:title', default='', namespaces=ns))
        if not bnf_title:
            continue

        # Extract ISBNs
        isbns = []
        for id_el in dc.findall('dc:identifier', ns):
            txt = id_el.text or ''
            m = re.search(r'(?:ISBN|EAN)\s*([0-9Xx\-]{10,17})', txt)
            if m:
                clean_isbn = re.sub(r'[^0-9Xx]', '', m.group(1))
                if len(clean_isbn) in (10, 13):
                    isbns.append(clean_isbn)

        if not isbns:
            continue

        rec_vol = extract_bnf_volume(bnf_title)
        rec_is_variant = is_variant_title(bnf_title) or bool(
            re.search(r'\b(?:collector|éd(?:ition)?\.?\s*collector|variante?|prestige)\b', bnf_title, re.I)
        )

        page_count = None
        for fmt in dc.findall('dc:format', ns):
            pc = parse_bnf_page_count(fmt.text)
            if pc:
                page_count = pc
                break

        collection_name = None
        for desc in dc.findall('dc:description', ns):
            col = parse_bnf_collection(desc.text)
            if col:
                collection_name = col
                break

        date_el = dc.findtext('dc:date', default=None, namespaces=ns)
        release_date = parse_bnf_date(date_el)

        authors = []
        for cr in dc.findall('dc:creator', ns) + dc.findall('dc:contributor', ns):
            if cr.text:
                first, last, role = parse_bnf_creator(cr.text)
                if last:
                    authors.append(ScrapedAuthor(firstname=first, lastname=last, role=role))

        ark = rec.findtext('.//srw:recordIdentifier', default=None, namespaces=ns)

        candidates.append({
            "isbn": isbns[0],
            "title": bnf_title,
            "volume": rec_vol,
            "is_variant": rec_is_variant,
            "page_count": page_count,
            "collection_name": collection_name,
            "release_date": release_date,
            "authors": authors,
            "ark": ark
        })

    if not candidates:
        return None

    scored = []
    for c in candidates:
        score = 0
        if volume is not None:
            if c["volume"] == volume:
                score += 60
            elif c["volume"] is None:
                score += 5
            else:
                score -= 60
        elif c["volume"] is not None and c["volume"] > 1:
            score -= 20

        if is_variant:
            if c["is_variant"]:
                score += 40
            else:
                score -= 30
        else:
            if not c["is_variant"]:
                score += 30
            else:
                score -= 40

        scored.append((score, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_candidate = scored[0]

    if best_score >= 10:
        logger.info(
            "BNF match for '%s' (vol %s, variant=%s): ISBN=%s, BNF title='%s' (score=%d)",
            title, volume, is_variant, best_candidate["isbn"], best_candidate["title"], best_score
        )
        return best_candidate

    return None


def lookup_bnf_by_isbn(isbn: str, timeout: int = 6) -> Optional[Dict[str, Any]]:
    """
    Directly looks up a book record in BNF SRU catalog by ISBN (10 or 13 digits).
    Returns a dict with title, volume, page_count, collection_name, release_date, authors, etc.
    """
    if not isbn:
        return None
    clean_isbn = re.sub(r'[^0-9Xx]', '', isbn)
    if len(clean_isbn) not in (10, 13):
        return None

    query = f'bib.isbn all "{clean_isbn}"'
    url = (
        f"{BNF_SRU_BASE_URL}?version=1.2&operation=searchRetrieve&recordSchema=dublincore"
        f"&maximumRecords=5&query={urllib.parse.quote(query)}"
    )

    ns = {
        'srw': 'http://www.loc.gov/zing/srw/',
        'oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
        'dc': 'http://purl.org/dc/elements/1.1/'
    }

    try:
        req = urllib.request.Request(url, headers={"User-Agent": BNF_USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)
        records = root.findall('.//srw:record', ns)
        if not records:
            return None

        for rec in records:
            dc = rec.find('.//oai_dc:dc', ns)
            if dc is None:
                continue

            bnf_title = clean_text(dc.findtext('dc:title', default='', namespaces=ns))
            page_count = None
            for fmt in dc.findall('dc:format', ns):
                pc = parse_bnf_page_count(fmt.text)
                if pc:
                    page_count = pc
                    break

            collection_name = None
            for desc in dc.findall('dc:description', ns):
                col = parse_bnf_collection(desc.text)
                if col:
                    collection_name = col
                    break

            date_el = dc.findtext('dc:date', default=None, namespaces=ns)
            release_date = parse_bnf_date(date_el)

            authors = []
            for cr in dc.findall('dc:creator', ns) + dc.findall('dc:contributor', ns):
                if cr.text:
                    first, last, role = parse_bnf_creator(cr.text)
                    if last:
                        authors.append(ScrapedAuthor(firstname=first, lastname=last, role=role))

            rec_vol = extract_bnf_volume(bnf_title) if bnf_title else None

            return {
                "isbn": clean_isbn,
                "title": bnf_title,
                "volume": rec_vol,
                "page_count": page_count,
                "collection_name": collection_name,
                "release_date": release_date,
                "authors": authors
            }
        return None
    except Exception as e:
        logger.warning("BNF ISBN lookup failed for %s: %s", clean_isbn, e)
        return None
