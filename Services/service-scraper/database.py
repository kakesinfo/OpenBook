import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from collections import defaultdict
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool

from config import settings
from scrapers.base import (
    ScrapedBook,
    clean_text,
    clean_author_name,
    split_author_name,
    is_variant_title,
    is_variant_book,
    strip_variant_suffix,
    extract_canonical_series_and_volume
)

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self._pool: Optional[pool.SimpleConnectionPool] = None

    def get_connection(self):
        if self._pool is None:
            self._pool = pool.SimpleConnectionPool(1, 10, self.db_url)
        return self._pool.getconn()

    def return_connection(self, conn):
        if self._pool and conn:
            self._pool.putconn(conn)

    def close(self):
        if self._pool:
            self._pool.closeall()
            self._pool = None

    def check_connection(self) -> bool:
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            self.return_connection(conn)
            return True
        except Exception as e:
            logger.error("Database connection check failed: %s", e)
            return False

    def repair_authors(self, cur=None):
        """
        Cleans up any author records that contain role prefixes (e.g. 'Auteur + illustrateurMathieu Bablet',
        'IllustrateurFlorent Maudoux', etc.), merges them into clean author records, and removes duplicate relations.
        """
        should_close = False
        conn = None
        if cur is None:
            conn = self.get_connection()
            cur = conn.cursor()
            should_close = True

        try:
            cur.execute("SELECT id, firstname, lastname FROM author;")
            authors = cur.fetchall()

            for a_id, fname, lname in authors:
                raw_full = f"{fname} {lname}".strip() if fname else lname
                clean_full = clean_author_name(raw_full)

                if clean_full != raw_full:
                    c_fname, c_lname = split_author_name(clean_full)
                    cur.execute(
                        "SELECT id FROM author WHERE LOWER(firstname) = LOWER(%s) AND LOWER(lastname) = LOWER(%s) AND id != %s;",
                        (c_fname, c_lname, a_id)
                    )
                    existing = cur.fetchone()

                    if existing:
                        target_id = existing[0]
                        # Re-point book_has_author without creating duplicates
                        cur.execute("""
                            DELETE FROM book_has_author
                            WHERE author_id = %s
                              AND book_id IN (SELECT book_id FROM book_has_author WHERE author_id = %s);
                        """, (a_id, target_id))
                        cur.execute("UPDATE book_has_author SET author_id = %s WHERE author_id = %s;", (target_id, a_id))
                        cur.execute("DELETE FROM author WHERE id = %s;", (a_id,))
                    else:
                        cur.execute("UPDATE author SET firstname = %s, lastname = %s WHERE id = %s;", (c_fname, c_lname, a_id))

            # Deduplicate book_has_author entries with identical book_id, author_id, role
            cur.execute("""
                DELETE FROM book_has_author a USING book_has_author b
                WHERE a.ctid < b.ctid
                  AND a.book_id = b.book_id
                  AND a.author_id = b.author_id
                  AND a.author_type_id = b.author_type_id;
            """)

            if should_close and conn:
                conn.commit()
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error("Error repairing authors in DB: %s", e)
            raise
        finally:
            if should_close and conn:
                cur.close()
                self.return_connection(conn)

    def deduplicate_books(self, cur=None) -> int:
        """
        Detects duplicate books (same editor with identical cover_url, same ISBN,
        or identical normalized title with missing ISBN), merges foreign keys,
        and deletes redundant duplicate records and any orphaned series.
        Returns the number of merged/purged duplicate books.
        """
        should_close = False
        conn = None
        if cur is None:
            conn = self.get_connection()
            cur = conn.cursor()
            should_close = True

        try:
            cur.execute("""
                SELECT b1.id, b2.id, b1.title, b2.title, b1.isbn, b2.isbn, b1.cover_url, b2.cover_url, b1.description, b2.description
                FROM book b1
                JOIN book b2 ON b1.id < b2.id AND b1.editor_id = b2.editor_id
                WHERE (b1.cover_url IS NOT NULL AND b1.cover_url != '' AND b1.cover_url = b2.cover_url)
                   OR (b1.isbn IS NOT NULL AND b1.isbn != '' AND b1.isbn = b2.isbn)
                   OR (regexp_replace(lower(b1.title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(b2.title), '[^a-z0-9]', '', 'g'));
            """)
            pairs = cur.fetchall()
            merged_count = 0
            handled_drops = set()

            bogus_titles = {
                "nos univers", "bronze books", "universal monsters", "adaptations littéraires",
                "la philo en bd", "l'école des loisirs en bd", "pierre lemaitre"
            }

            for id1, id2, t1, t2, isbn1, isbn2, c1, c2, d1, d2 in pairs:
                if id1 in handled_drops or id2 in handled_drops:
                    continue

                # Skip distinct volumes/variants with different cover images
                if c1 != c2 and (isbn1 != isbn2 or not isbn1):
                    if "nanarland" in t1.lower() or is_variant_title(t1) or is_variant_title(t2):
                        continue

                t1_bogus = t1.strip().lower() in bogus_titles
                t2_bogus = t2.strip().lower() in bogus_titles

                if t1_bogus and not t2_bogus:
                    keep_id, drop_id = id2, id1
                    keep_t, drop_t = t2, t1
                    keep_isbn, drop_isbn = isbn2, isbn1
                    keep_desc, drop_desc = d2, d1
                elif t2_bogus and not t1_bogus:
                    keep_id, drop_id = id1, id2
                    keep_t, drop_t = t1, t2
                    keep_isbn, drop_isbn = isbn1, isbn2
                    keep_desc, drop_desc = d1, d2
                elif isbn1 and not isbn2:
                    keep_id, drop_id = id1, id2
                    keep_t, drop_t = t1, t2
                    keep_isbn, drop_isbn = isbn1, isbn2
                    keep_desc, drop_desc = d1, d2
                elif isbn2 and not isbn1:
                    keep_id, drop_id = id2, id1
                    keep_t, drop_t = t2, t1
                    keep_isbn, drop_isbn = isbn2, isbn1
                    keep_desc, drop_desc = d2, d1
                elif len(t1) >= len(t2):
                    keep_id, drop_id = id1, id2
                    keep_t, drop_t = t1, t2
                    keep_isbn, drop_isbn = isbn1, isbn2
                    keep_desc, drop_desc = d1, d2
                else:
                    keep_id, drop_id = id2, id1
                    keep_t, drop_t = t2, t1
                    keep_isbn, drop_isbn = isbn2, isbn1
                    keep_desc, drop_desc = d2, d1

                handled_drops.add(drop_id)

                # 1. Enrich canonical book with ISBN or description if missing
                if not keep_isbn and drop_isbn:
                    cur.execute("UPDATE book SET isbn = %s WHERE id = %s;", (drop_isbn, keep_id))
                if not keep_desc and drop_desc:
                    cur.execute("UPDATE book SET description = %s WHERE id = %s;", (drop_desc, keep_id))

                # 2. Re-point user_owns_book
                cur.execute("""
                    DELETE FROM user_owns_book
                    WHERE book_id = %s
                      AND user_id IN (SELECT user_id FROM user_owns_book WHERE book_id = %s);
                """, (drop_id, keep_id))
                cur.execute("UPDATE user_owns_book SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 3. Re-point book_status
                cur.execute("""
                    DELETE FROM book_status
                    WHERE book_id = %s
                      AND user_id IN (SELECT user_id FROM book_status WHERE book_id = %s);
                """, (drop_id, keep_id))
                cur.execute("UPDATE book_status SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 4. Re-point reading_session
                cur.execute("UPDATE reading_session SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 5. Re-point book_has_author
                cur.execute("""
                    DELETE FROM book_has_author
                    WHERE book_id = %s
                      AND author_id IN (SELECT author_id FROM book_has_author WHERE book_id = %s);
                """, (drop_id, keep_id))
                cur.execute("UPDATE book_has_author SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 6. Re-point book_has_theme
                cur.execute("""
                    DELETE FROM book_has_theme
                    WHERE book_id = %s
                      AND theme_id IN (SELECT theme_id FROM book_has_theme WHERE book_id = %s);
                """, (drop_id, keep_id))
                cur.execute("UPDATE book_has_theme SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 7. Re-point book_has_image
                cur.execute("UPDATE book_has_image SET book_id = %s WHERE book_id = %s;", (keep_id, drop_id))

                # 8. Delete duplicate book
                cur.execute("DELETE FROM book WHERE id = %s;", (drop_id,))
                merged_count += 1

            # 9. Purge orphan series created by duplicates
            cur.execute("DELETE FROM series_has_theme WHERE series_id NOT IN (SELECT DISTINCT series_id FROM book);")
            cur.execute("DELETE FROM series WHERE id NOT IN (SELECT DISTINCT series_id FROM book);")

            if should_close and conn:
                conn.commit()
            if merged_count > 0:
                logger.info("Deduplicated and merged %d redundant book records.", merged_count)
            return merged_count
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error("Error deduplicating books in DB: %s", e)
            raise
        finally:
            if should_close and conn:
                cur.close()
                self.return_connection(conn)

    def repair_mojibake(self) -> Dict[str, Any]:
        """Repairs corrupted double-encoded UTF-8, cleans bogus authors, and merges duplicates."""
        conn = None
        repaired_books = 0
        repaired_series = 0
        merged_duplicates = 0
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                # 1. Repair books
                cur.execute("SELECT id, title, description FROM book WHERE title ~ '[ÃÂ]' OR description ~ '[ÃÂ]';")
                books = cur.fetchall()
                for b_id, title, desc in books:
                    new_title = clean_text(title)
                    new_desc = clean_text(desc)
                    cur.execute("UPDATE book SET title = %s, description = %s WHERE id = %s;", (new_title, new_desc, b_id))
                repaired_books = len(books)

                # 2. Repair series
                cur.execute("SELECT id, name FROM series WHERE name ~ '[ÃÂ]';")
                series = cur.fetchall()
                for s_id, name in series:
                    new_name = clean_text(name)
                    cur.execute("SELECT id FROM series WHERE name = %s AND id != %s;", (new_name, s_id))
                    existing = cur.fetchone()
                    if existing:
                        target_id = existing[0]
                        cur.execute("UPDATE book SET series_id = %s WHERE series_id = %s;", (target_id, s_id))
                        cur.execute("DELETE FROM series_has_theme WHERE series_id = %s;", (s_id,))
                        cur.execute("DELETE FROM series WHERE id = %s;", (s_id,))
                    else:
                        cur.execute("UPDATE series SET name = %s WHERE id = %s;", (new_name, s_id))
                repaired_series = len(series)

                # 3. Purge bogus scraper authors
                cur.execute("""
                    DELETE FROM book_has_author 
                    WHERE author_id IN (
                        SELECT id FROM author WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs')
                    );
                """)
                cur.execute("""
                    DELETE FROM author 
                    WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs');
                """)

                # 4. Repair & consolidate corrupted author names and relations
                self.repair_authors(cur)

                # 5. Merge duplicates across all editors
                merged_duplicates = self.deduplicate_books(cur)

                conn.commit()
                if books or series:
                    logger.info("Repaired %d books and %d series corrupted by mojibake.", len(books), len(series))
                return {
                    "repaired_books": repaired_books,
                    "repaired_series": repaired_series,
                    "merged_duplicates": merged_duplicates
                }
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error repairing mojibake in DB: %s", e)
            raise
        finally:
            if conn:
                self.return_connection(conn)

    def get_maintenance_stats(self) -> Dict[str, Any]:
        """Returns entity counts for the admin maintenance page."""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM book;")
                total_books = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM series;")
                total_series = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM editor;")
                total_editors = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM author;")
                total_authors = cur.fetchone()[0]
                return {
                    "total_books": total_books,
                    "total_series": total_series,
                    "total_editors": total_editors,
                    "total_authors": total_authors
                }
        except Exception as e:
            logger.error("Error getting maintenance stats: %s", e)
            return {"total_books": 0, "total_series": 0, "total_editors": 0, "total_authors": 0}
        finally:
            if conn:
                self.return_connection(conn)

    def upsert_book(self, book: ScrapedBook) -> Optional[int]:
        """
        Inserts or updates a book and its related entities (editor, series, category, authors).
        Uses multi-criteria matching (ISBN, exact cover URL, normalized title, series+volume)
        to prevent duplicate entries while keeping variants properly separate.
        Returns the book ID if successful.
        """
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                # 1. Clean strings
                clean_title = clean_text(book.title)
                clean_series_name = clean_text(book.series_name or book.title)
                clean_editor_name = clean_text(book.editor_name)
                clean_desc = clean_text(book.description)
                clean_isbn = book.isbn.strip() if book.isbn else None

                # Extract ISBN from cover URL if missing
                if not clean_isbn and book.cover_url:
                    isbn_m = re.search(r"/(?:album|principal|prod|cache/[^/]+/[^/]+)/([0-9]{10,13})", book.cover_url)
                    if isbn_m:
                        clean_isbn = isbn_m.group(1)

                # 2. Editor
                editor_id = None
                if clean_editor_name:
                    cur.execute("SELECT id FROM editor WHERE LOWER(name) = LOWER(%s);", (clean_editor_name,))
                    row = cur.fetchone()
                    if row:
                        editor_id = row[0]
                    else:
                        cur.execute(
                            "INSERT INTO editor (name, created_at, updated_at) VALUES (%s, NOW(), NOW()) RETURNING id;",
                            (clean_editor_name,)
                        )
                        editor_id = cur.fetchone()[0]

                # 3. Category
                category_id = 3  # Default: Comics
                cat_name = clean_text(book.category_name) or "Comics"
                cur.execute("SELECT id FROM category WHERE LOWER(name) = LOWER(%s);", (cat_name,))
                row = cur.fetchone()
                if row:
                    category_id = row[0]
                else:
                    cur.execute("SELECT id FROM category WHERE name = 'Comics';")
                    fallback = cur.fetchone()
                    if fallback:
                        category_id = fallback[0]

                # 4. Collection
                collection_id = None
                clean_col_name = clean_text(book.collection_name)
                if clean_col_name:
                    cur.execute("SELECT id FROM collection WHERE LOWER(name) = LOWER(%s);", (clean_col_name,))
                    col_row = cur.fetchone()
                    if col_row:
                        collection_id = col_row[0]
                    else:
                        cur.execute(
                            "INSERT INTO collection (name, created_at, updated_at) VALUES (%s, NOW(), NOW()) RETURNING id;",
                            (clean_col_name,)
                        )
                        collection_id = cur.fetchone()[0]

                # 5. Series (with automatic qualifier / conflict prevention)
                canon_sname, canon_vol = extract_canonical_series_and_volume(clean_series_name)
                if canon_sname:
                    clean_series_name = canon_sname
                if not book.volume and canon_vol:
                    book.volume = canon_vol

                target_series_name = clean_series_name
                if book.series_qualifier:
                    target_series_name = f"{clean_series_name} ({book.series_qualifier})"
                elif clean_series_name and book.volume:
                    # Check if candidate series exists and has volume conflicts with different format
                    cur.execute("SELECT id FROM series WHERE LOWER(name) = LOWER(%s);", (clean_series_name,))
                    s_row = cur.fetchone()
                    if s_row:
                        cand_id = s_row[0]
                        cur.execute(
                            "SELECT id, page_count, price, title FROM book WHERE series_id = %s AND volume = %s;",
                            (cand_id, book.volume)
                        )
                        conflicts = cur.fetchall()
                        for c_id, c_pages, c_price, c_title in conflicts:
                            if (
                                (c_pages and book.page_count and c_pages >= 500 and book.page_count <= 350)
                                or (c_price and book.price and c_price >= 20 and book.price <= 10)
                                or ("poche" in (book.title or "").lower())
                            ):
                                target_series_name = f"{clean_series_name} (Poche)"
                                break

                cur.execute("SELECT id FROM series WHERE LOWER(name) = LOWER(%s);", (target_series_name,))
                row = cur.fetchone()
                if row:
                    series_id = row[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO series (name, status, category_id, created_at, updated_at)
                        VALUES (%s, 'ON_GOING', %s, NOW(), NOW())
                        RETURNING id;
                        """,
                        (target_series_name, category_id)
                    )
                    series_id = cur.fetchone()[0]

                # Check variant cover linkage
                incoming_is_variant = is_variant_book(clean_title, book.cover_url) or getattr(book, "is_variant", False)
                parent_book_id = getattr(book, "parent_book_id", None)
                if not parent_book_id and incoming_is_variant and series_id and book.volume:
                    cur.execute(
                        """
                        SELECT id, title FROM book 
                        WHERE series_id = %s AND volume = %s 
                          AND (parent_book_id IS NULL OR parent_book_id = 0)
                        ORDER BY id ASC;
                        """,
                        (series_id, book.volume)
                    )
                    for p_id, p_title in cur.fetchall():
                        if not is_variant_book(p_title):
                            parent_book_id = p_id
                            break

                # 5. Check if Book already exists (Multi-criteria matching)
                book_id = None

                # Criterion A: ISBN match
                if clean_isbn:
                    cur.execute("SELECT id FROM book WHERE isbn = %s;", (clean_isbn,))
                    row = cur.fetchone()
                    if row:
                        book_id = row[0]

                # Criterion B: Identical cover URL for same editor
                if not book_id and book.cover_url and editor_id:
                    cur.execute(
                        "SELECT id FROM book WHERE cover_url = %s AND editor_id = %s;",
                        (book.cover_url, editor_id)
                    )
                    row = cur.fetchone()
                    if row:
                        book_id = row[0]

                # Criterion C: Normalized title match (ignoring dashes, colons, case, spaces, and punctuation)
                if not book_id and clean_title and editor_id:
                    cur.execute(
                        """
                        SELECT id FROM book 
                        WHERE editor_id = %s 
                          AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(%s), '[^a-z0-9]', '', 'g');
                        """,
                        (editor_id, clean_title)
                    )
                    row = cur.fetchone()
                    if row:
                        book_id = row[0]

                # Criterion D: Exact series + volume match (if volume > 0)
                # CRITICAL: A variant must NOT match an existing standard book, and a standard book must NOT match a variant.
                if not book_id and series_id and book.volume and book.volume > 0:
                    cur.execute(
                        "SELECT id, title FROM book WHERE series_id = %s AND volume = %s ORDER BY id ASC;",
                        (series_id, book.volume)
                    )
                    for cand_id, cand_title in cur.fetchall():
                        cand_is_variant = is_variant_book(cand_title)
                        if incoming_is_variant == cand_is_variant:
                            if not incoming_is_variant or clean_text(cand_title).lower() == clean_title.lower():
                                book_id = cand_id
                                break

                if book_id:
                    # Guard against self-reference
                    if parent_book_id and parent_book_id == book_id:
                        parent_book_id = None

                    # UPDATE existing book
                    cur.execute(
                        """
                        UPDATE book
                        SET updated_at = NOW(),
                            price = COALESCE(NULLIF(%s, 0), price),
                            page_count = COALESCE(NULLIF(%s, 0), page_count),
                            release_date = COALESCE(%s, release_date),
                            description = COALESCE(%s, description),
                            cover_url = COALESCE(%s, cover_url),
                            collection_id = COALESCE(%s, collection_id),
                            parent_book_id = CASE
                                WHEN %s::int IS NOT NULL AND %s::int != id THEN %s::int
                                WHEN parent_book_id = id THEN NULL
                                ELSE parent_book_id
                            END
                        WHERE id = %s;
                        """,
                        (
                            book.price or 0,
                            book.page_count or 0,
                            book.release_date,
                            clean_desc,
                            book.cover_url,
                            collection_id,
                            parent_book_id,
                            parent_book_id,
                            parent_book_id,
                            book_id
                        )
                    )

                    # Enrich existing book with ISBN if it was missing
                    if clean_isbn:
                        cur.execute(
                            "UPDATE book SET isbn = %s WHERE id = %s AND (isbn IS NULL OR isbn = '');",
                            (clean_isbn, book_id)
                        )

                    # Update title if current title was a generic collection title or shorter stub
                    cur.execute("SELECT title FROM book WHERE id = %s;", (book_id,))
                    curr_row = cur.fetchone()
                    if curr_row and curr_row[0]:
                        curr_t = curr_row[0]
                        bogus_titles = {
                            "nos univers", "bronze books", "universal monsters",
                            "adaptations littéraires", "la philo en bd", "l'école des loisirs en bd"
                        }
                        if curr_t.strip().lower() in bogus_titles or (
                            len(clean_title) > len(curr_t) and clean_title.strip().lower() not in bogus_titles
                        ):
                            cur.execute("UPDATE book SET title = %s WHERE id = %s;", (clean_title, book_id))

                    logger.debug("Updated existing book id %s: %s", book_id, clean_title)
                else:
                    # Guard against self-reference
                    if parent_book_id and parent_book_id == book_id:
                        parent_book_id = None

                    # INSERT new book
                    cur.execute(
                        """
                        INSERT INTO book (
                            title, series_id, editor_id, collection_id,
                            volume, isbn, page_count, price, description,
                            cover_url, release_date, type, parent_book_id,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            NOW(), NOW()
                        ) RETURNING id;
                        """,
                        (
                            clean_title,
                            series_id,
                            editor_id,
                            collection_id,
                            book.volume or 1,
                            clean_isbn,
                            book.page_count or 0,
                            book.price or 0,
                            clean_desc,
                            book.cover_url,
                            book.release_date or datetime.now(),
                            book.book_type or "Comics",
                            parent_book_id
                        )
                    )
                    book_id = cur.fetchone()[0]
                    logger.debug("Inserted new book id %s: %s", book_id, clean_title)

                # 6. Save Authors
                if book.authors:
                    for author_data in book.authors:
                        clean_fn = clean_text(author_data.firstname) or ""
                        clean_ln = clean_text(author_data.lastname)
                        if not clean_ln:
                            continue

                        cur.execute(
                            "SELECT id FROM author WHERE LOWER(firstname) = LOWER(%s) AND LOWER(lastname) = LOWER(%s);",
                            (clean_fn, clean_ln)
                        )
                        row = cur.fetchone()
                        if row:
                            author_id = row[0]
                        else:
                            cur.execute(
                                "INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES (%s, %s, NOW(), NOW()) RETURNING id;",
                                (clean_fn, clean_ln)
                            )
                            author_id = cur.fetchone()[0]

                        author_type_map = {"writer": 1, "scénariste": 1, "illustrator": 2, "dessinateur": 2, "colorist": 3, "coloriste": 3}
                        author_type_id = author_type_map.get((author_data.role or "").lower(), 1)
                        cur.execute(
                            "SELECT 1 FROM book_has_author WHERE book_id = %s AND author_id = %s AND author_type_id = %s;",
                            (book_id, author_id, author_type_id)
                        )
                        if not cur.fetchone():
                            cur.execute(
                                "INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) VALUES (%s, %s, %s, NOW(), NOW());",
                                (book_id, author_id, author_type_id)
                            )

                conn.commit()
                return book_id
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error upserting book '%s': %s", book.title, e)
            return None
        finally:
            if conn:
                self.return_connection(conn)


    def detect_volume_conflicts(self) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT b.series_id, s.name as series_name, b.volume, COUNT(*)
                    FROM book b
                    JOIN series s ON b.series_id = s.id
                    WHERE b.volume IS NOT NULL AND b.parent_book_id IS NULL
                    GROUP BY b.series_id, s.name, b.volume
                    HAVING COUNT(*) > 1
                    ORDER BY s.name, b.volume;
                    """
                )
                conflicts = cur.fetchall()

                result = []
                seen_series = set()

                for sid, sname, vol, count in conflicts:
                    if sid in seen_series:
                        continue
                    seen_series.add(sid)
                    cur.execute(
                        """
                        SELECT b.id, b.title, b.volume, b.isbn, b.price, b.page_count, 
                               b.release_date, b.cover_url, c.name as collection_name,
                               b.parent_book_id
                        FROM book b
                        LEFT JOIN collection c ON b.collection_id = c.id
                        WHERE b.series_id = %s AND b.parent_book_id IS NULL
                        ORDER BY b.volume, b.release_date, b.id;
                        """,
                        (sid,)
                    )
                    books = []
                    for row in cur.fetchall():
                        books.append({
                            "id": row[0],
                            "title": row[1],
                            "volume": row[2],
                            "isbn": row[3],
                            "price": row[4],
                            "page_count": row[5],
                            "release_date": row[6].strftime("%Y-%m-%d") if row[6] else None,
                            "cover_url": row[7],
                            "collection_name": row[8],
                            "is_variant_hint": is_variant_title(row[1])
                        })
                    result.append({
                        "series_id": sid,
                        "series_name": sname,
                        "conflicting_volume": vol,
                        "books": books
                    })
                return result
        except Exception as e:
            logger.error("Error detecting volume conflicts: %s", e)
            return []
        finally:
            if conn:
                self.return_connection(conn)

    def link_as_variant(self, parent_book_id: int, variant_book_ids: List[int]) -> Dict[str, Any]:
        if not parent_book_id or not variant_book_ids:
            raise ValueError("parent_book_id and variant_book_ids are required")
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE book
                    SET parent_book_id = %s, updated_at = NOW()
                    WHERE id = ANY(%s) AND id != %s;
                    """,
                    (parent_book_id, variant_book_ids, parent_book_id)
                )
                count = cur.rowcount
                conn.commit()
                logger.info("Linked %d books as variant of book %s", count, parent_book_id)
                return {
                    "status": "success",
                    "linked_count": count,
                    "parent_book_id": parent_book_id,
                    "variant_book_ids": variant_book_ids
                }
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error linking books as variant: %s", e)
            raise
        finally:
            if conn:
                self.return_connection(conn)

    def reconcile_variants(self) -> Dict[str, Any]:
        """
        Executes a post-scan reconciliation of variant and collector books:
        1. Breaks any invalid self-referencing (parent_book_id == id) or dangling parent links.
        2. Normalizes series for books placed into separate 'variant' or 'volume' series by older scrapes.
        3. Normalizes titles for variant covers lacking collector suffix and fixes double suffixes.
        4. Within each series, groups books by volume (and for unnumbered books, by base title)
           and couples variant books with their corresponding standard edition parent.
        5. Purges orphaned empty series.
        """
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                # 1. Break self-referencing and dangling parent links
                cur.execute(
                    """
                    UPDATE book
                    SET parent_book_id = NULL, updated_at = NOW()
                    WHERE parent_book_id = id;
                    """
                )
                self_ref_fixed = cur.rowcount

                cur.execute(
                    """
                    UPDATE book
                    SET parent_book_id = NULL, updated_at = NOW()
                    WHERE parent_book_id IS NOT NULL
                      AND parent_book_id NOT IN (SELECT id FROM book);
                    """
                )
                dangling_fixed = cur.rowcount

                # 2. Normalize dirty series (with volume or variant suffixes in series name)
                cur.execute(
                    r"""
                    SELECT id, name, category_id FROM series
                    WHERE name ~* '(?:T(?:ome)?|Vol(?:ume)?|N°|#)\\s*0?\\d+'
                       OR name ~* '\\b(?:couverture\\s+variante|variant(?:e)?|couv\\.?\\s*var\\.?|(?:[eé]dition|coffret)\\s+collector|collector|[eé]dition\\s+sp[eé]ciale|[eé]dition\\s+limit[eé]e|[eé]dition\\s+prestige|n&b|noir\\s+et\\s+blanc)\\b';
                    """
                )
                dirty_series = cur.fetchall()
                series_reassigned = 0

                for s_id, s_name, cat_id in dirty_series:
                    canon_name, extracted_vol = extract_canonical_series_and_volume(s_name)
                    if not canon_name or canon_name.lower() == s_name.lower():
                        continue

                    cur.execute("SELECT id FROM series WHERE LOWER(name) = LOWER(%s);", (canon_name,))
                    canon_row = cur.fetchone()
                    if canon_row:
                        canon_id = canon_row[0]
                    else:
                        cur.execute(
                            "INSERT INTO series (name, status, category_id, created_at, updated_at) VALUES (%s, 'ON_GOING', %s, NOW(), NOW()) RETURNING id;",
                            (canon_name, cat_id)
                        )
                        canon_id = cur.fetchone()[0]

                    if extracted_vol:
                        cur.execute(
                            """
                            UPDATE book
                            SET series_id = %s,
                                volume = CASE WHEN volume IS NULL OR volume = 1 THEN %s ELSE volume END,
                                updated_at = NOW()
                            WHERE series_id = %s;
                            """,
                            (canon_id, extracted_vol, s_id)
                        )
                    else:
                        cur.execute(
                            "UPDATE book SET series_id = %s, updated_at = NOW() WHERE series_id = %s;",
                            (canon_id, s_id)
                        )
                    series_reassigned += cur.rowcount

                    cur.execute("DELETE FROM series WHERE id = %s AND NOT EXISTS (SELECT 1 FROM book WHERE series_id = series.id);", (s_id,))

                # 3. Clean up double 'Edition collector' repetitions in book titles
                cur.execute(
                    r"""
                    UPDATE book
                    SET title = regexp_replace(title, '(\s*-\s*Edition collector)+', ' - Edition collector', 'gi')
                    WHERE title ILIKE '%Edition collector%Edition collector%';
                    """
                )

                # 4. If a book has a variant cover (e.g. fxm26014v_0.jpg) but title lacked variant suffix, append it
                cur.execute(
                    r"""
                    SELECT id, title, cover_url FROM book
                    WHERE cover_url ~* '[a-z0-9]+v_\d+\.(?:jpg|jpeg|png|webp)'
                      AND NOT (title ~* '\b(?:couverture\s+variante|variant(?:e)?|collector)\b');
                    """
                )
                for b_id, b_title, b_cov in cur.fetchall():
                    new_title = clean_text(b_title) + " - Edition collector"
                    cur.execute("UPDATE book SET title = %s, updated_at = NOW() WHERE id = %s;", (new_title, b_id))

                # 5. Group books in series to match and link variants
                cur.execute(
                    """
                    SELECT b.id, b.title, b.volume, b.series_id, b.parent_book_id, b.cover_url, b.price
                    FROM book b
                    WHERE b.series_id IN (
                        SELECT series_id FROM book GROUP BY series_id HAVING COUNT(*) > 1
                    )
                    ORDER BY b.series_id, b.volume NULLS LAST, b.id ASC;
                    """
                )
                all_books = cur.fetchall()

                series_groups = defaultdict(list)
                for row in all_books:
                    series_groups[row[3]].append({
                        "id": row[0],
                        "title": row[1],
                        "volume": row[2],
                        "series_id": row[3],
                        "parent_book_id": row[4],
                        "cover_url": row[5],
                        "price": row[6],
                        "is_variant": is_variant_book(row[1], row[5])
                    })

                variants_linked = 0
                for s_id, books_in_series in series_groups.items():
                    vol_groups = defaultdict(list)
                    for b in books_in_series:
                        vol_groups[b["volume"]].append(b)

                    for vol, group in vol_groups.items():
                        if vol is not None:
                            standards = [b for b in group if not b["is_variant"]]
                            variants = [b for b in group if b["is_variant"]]

                            if standards and variants:
                                parent_id = standards[0]["id"]
                                for v in variants:
                                    if v["id"] != parent_id and v["parent_book_id"] != parent_id:
                                        cur.execute(
                                            "UPDATE book SET parent_book_id = %s, updated_at = NOW() WHERE id = %s;",
                                            (parent_id, v["id"])
                                        )
                                        variants_linked += cur.rowcount
                                        v["parent_book_id"] = parent_id

                                if standards[0]["parent_book_id"] is not None:
                                    cur.execute(
                                        "UPDATE book SET parent_book_id = NULL, updated_at = NOW() WHERE id = %s;",
                                        (parent_id,)
                                    )
                                    standards[0]["parent_book_id"] = None
                        else:
                            for b in group:
                                if b["is_variant"] and not b["parent_book_id"]:
                                    base_v = strip_variant_suffix(b["title"]).lower()
                                    for std in group:
                                        if not std["is_variant"] and strip_variant_suffix(std["title"]).lower() == base_v:
                                            if b["id"] != std["id"]:
                                                cur.execute(
                                                    "UPDATE book SET parent_book_id = %s, updated_at = NOW() WHERE id = %s;",
                                                    (std["id"], b["id"])
                                                )
                                                variants_linked += cur.rowcount
                                                b["parent_book_id"] = std["id"]
                                                break

                conn.commit()
                logger.info(
                    "Reconciled variants: self_ref_fixed=%d, dangling_fixed=%d, series_reassigned=%d, variants_linked=%d",
                    self_ref_fixed, dangling_fixed, series_reassigned, variants_linked
                )
                return {
                    "status": "success",
                    "self_ref_fixed": self_ref_fixed,
                    "dangling_fixed": dangling_fixed,
                    "series_reassigned": series_reassigned,
                    "variants_linked": variants_linked
                }
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error during reconcile_variants: %s", e)
            raise
        finally:
            if conn:
                self.return_connection(conn)

    def split_series(self, source_series_id: int, new_series_name: str, book_ids: List[int]) -> Dict[str, Any]:
        if not new_series_name or not book_ids:
            raise ValueError("new_series_name and book_ids are required")
        clean_new_name = clean_text(new_series_name)
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                # Check source series
                cur.execute("SELECT category_id, status FROM series WHERE id = %s;", (source_series_id,))
                src = cur.fetchone()
                if not src:
                    raise ValueError(f"Series with id {source_series_id} not found")
                category_id, status = src

                # Find or create new series
                cur.execute("SELECT id FROM series WHERE LOWER(name) = LOWER(%s);", (clean_new_name,))
                row = cur.fetchone()
                if row:
                    new_series_id = row[0]
                else:
                    cur.execute(
                        """
                        INSERT INTO series (name, status, category_id, created_at, updated_at)
                        VALUES (%s, %s, %s, NOW(), NOW())
                        RETURNING id;
                        """,
                        (clean_new_name, status, category_id)
                    )
                    new_series_id = cur.fetchone()[0]

                # Move books
                cur.execute(
                    """
                    UPDATE book
                    SET series_id = %s, updated_at = NOW()
                    WHERE id = ANY(%s) AND series_id = %s;
                    """,
                    (new_series_id, book_ids, source_series_id)
                )
                moved_count = cur.rowcount
                conn.commit()

                logger.info(
                    "Split series %s -> %s (%s): moved %d books",
                    source_series_id, new_series_id, clean_new_name, moved_count
                )
                return {
                    "status": "success",
                    "moved_count": moved_count,
                    "source_series_id": source_series_id,
                    "new_series_id": new_series_id,
                    "new_series_name": clean_new_name
                }
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error splitting series: %s", e)
            raise
        finally:
            if conn:
                self.return_connection(conn)

    def get_recent_books(self, limit: int = 20) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT b.id, b.title, b.isbn, b.volume, b.release_date, b.cover_url,
                           e.name as editor_name, s.name as series_name
                    FROM book b
                    LEFT JOIN editor e ON b.editor_id = e.id
                    LEFT JOIN series s ON b.series_id = s.id
                    ORDER BY b.created_at DESC
                    LIMIT %s;
                    """,
                    (limit,)
                )
                return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            logger.error("Error fetching recent books: %s", e)
            return []
        finally:
            if conn:
                self.return_connection(conn)

# Singleton DB instance
db = Database(settings.DATABASE_URL)
