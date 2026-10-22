import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool

from config import settings
from scrapers.base import ScrapedBook, clean_text, clean_author_name, split_author_name

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
            cur.execute("""
                SELECT id, firstname, lastname 
                FROM author 
                WHERE firstname ~* '^(par|de|texte|sc[eé]nariste|sc[eé]nario|illustration|dessin|auteur|illustrat|colorist|[\\+:\\-_/])'
                   OR lastname ~* '^(par\\s+|de\\s+|texte|sc[eé]nariste|sc[eé]nario|illustration|dessin|auteur|illustrat|colorist|\\+)'
                   OR firstname ~* '(illustrateur|scénariste|auteur|dessinateur)'
                   OR lastname ~* '(illustrateur|scénariste|auteur|dessinateur)';
            """)
            corrupted = cur.fetchall()
            repaired_count = 0
            for a_id, first, last in corrupted:
                full_raw = f"{first or ''} {last or ''}".strip()
                cleaned_full = clean_author_name(full_raw)
                if not cleaned_full or cleaned_full == full_raw:
                    continue

                new_first, new_last = split_author_name(cleaned_full)
                if not new_last:
                    continue

                # Check if a clean author record already exists
                cur.execute(
                    "SELECT id FROM author WHERE LOWER(firstname) = LOWER(%s) AND LOWER(lastname) = LOWER(%s) AND id != %s;",
                    (new_first, new_last, a_id)
                )
                existing = cur.fetchone()
                if existing:
                    target_id = existing[0]
                    # 1. Delete duplicate book_has_author links for books that already have target_id
                    cur.execute("""
                        DELETE FROM book_has_author
                        WHERE author_id = %s
                          AND book_id IN (
                              SELECT book_id FROM book_has_author WHERE author_id = %s
                          );
                    """, (a_id, target_id))
                    # 2. Re-point remaining book_has_author links to target_id
                    cur.execute(
                        "UPDATE book_has_author SET author_id = %s WHERE author_id = %s;",
                        (target_id, a_id)
                    )
                    # 3. Delete the corrupted author
                    cur.execute("DELETE FROM author WHERE id = %s;", (a_id,))
                else:
                    # No duplicate author exists, update in place
                    cur.execute(
                        "UPDATE author SET firstname = %s, lastname = %s, updated_at = NOW() WHERE id = %s;",
                        (new_first, new_last, a_id)
                    )
                repaired_count += 1

            # 4. Remove any duplicate (book_id, author_id) relations in book_has_author
            cur.execute("""
                DELETE FROM book_has_author a
                USING book_has_author b
                WHERE a.id > b.id
                  AND a.book_id = b.book_id
                  AND a.author_id = b.author_id;
            """)

            if should_close and conn:
                conn.commit()
            if repaired_count > 0:
                logger.info("Repaired and consolidated %d corrupted author records.", repaired_count)
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error("Error repairing authors in DB: %s", e)
            raise
        finally:
            if should_close and conn:
                cur.close()
                self.return_connection(conn)

    def deduplicate_books(self, cur=None):
        """
        Detects duplicate books (same editor with identical cover_url, same ISBN,
        or identical normalized title with missing ISBN), merges foreign keys,
        and deletes redundant duplicate records and any orphaned series.
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
                    if "nanarland" in t1.lower() or "x-men" in t1.lower():
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
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error("Error deduplicating books in DB: %s", e)
            raise
        finally:
            if should_close and conn:
                cur.close()
                self.return_connection(conn)

    def repair_mojibake(self):
        """Repairs corrupted double-encoded UTF-8, cleans bogus authors, and merges duplicates."""
        conn = None
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
                self.deduplicate_books(cur)

                conn.commit()
                if books or series:
                    logger.info("Repaired %d books and %d series corrupted by mojibake.", len(books), len(series))
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Error repairing mojibake in DB: %s", e)
        finally:
            if conn:
                self.return_connection(conn)

    def upsert_book(self, book: ScrapedBook) -> Optional[int]:
        """
        Inserts or updates a book and its related entities (editor, series, category, authors).
        Uses multi-criteria matching (ISBN, exact cover URL, normalized title, series+volume)
        to prevent duplicate entries when minor title differences or missing ISBN occur.
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

                # 4. Series
                cur.execute("SELECT id FROM series WHERE LOWER(name) = LOWER(%s);", (clean_series_name,))
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
                        (clean_series_name, category_id)
                    )
                    series_id = cur.fetchone()[0]

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
                if not book_id and series_id and book.volume and book.volume > 0:
                    cur.execute(
                        "SELECT id FROM book WHERE series_id = %s AND volume = %s;",
                        (series_id, book.volume)
                    )
                    row = cur.fetchone()
                    if row:
                        book_id = row[0]

                rel_date = book.release_date or datetime.now()

                if book_id:
                    # UPDATE existing book
                    cur.execute(
                        """
                        UPDATE book
                        SET cover_url = COALESCE(%s, cover_url),
                            description = COALESCE(%s, description),
                            price = CASE WHEN %s > 0 THEN %s ELSE price END,
                            page_count = CASE WHEN %s > 0 THEN %s ELSE page_count END,
                            release_date = COALESCE(%s, release_date),
                            editor_id = COALESCE(%s, editor_id),
                            type = COALESCE(%s, type),
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id;
                        """,
                        (
                            book.cover_url,
                            clean_desc,
                            book.price, book.price,
                            book.page_count, book.page_count,
                            book.release_date,
                            editor_id,
                            book.book_type,
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
                    # INSERT new book
                    cur.execute(
                        """
                        INSERT INTO book (
                            title, isbn, volume, page_count, price, description,
                            series_id, editor_id, release_date, created_at, updated_at,
                            cover_url, type, weight, height, length, thickness
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, NOW(), NOW(),
                            %s, %s, 0, 0, 0, 0
                        ) RETURNING id;
                        """,
                        (
                            clean_title,
                            clean_isbn,
                            book.volume or 1,
                            book.page_count or 0,
                            book.price or 0,
                            clean_desc or f"{clean_title} - Bande dessinée / Comics",
                            series_id,
                            editor_id,
                            rel_date,
                            book.cover_url,
                            book.book_type or "Comics"
                        )
                    )
                    book_id = cur.fetchone()[0]
                    logger.info("Inserted new book id %s: %s", book_id, clean_title)

                # 6. Authors
                if book.authors and book_id:
                    for author in book.authors:
                        full_name = f"{author.firstname or ''} {author.lastname or ''}".strip()
                        clean_first, clean_last = split_author_name(full_name)
                        if not clean_last:
                            continue
                        cur.execute(
                            "SELECT id FROM author WHERE LOWER(firstname) = LOWER(%s) AND LOWER(lastname) = LOWER(%s);",
                            (clean_first, clean_last)
                        )
                        a_row = cur.fetchone()
                        if a_row:
                            author_id = a_row[0]
                        else:
                            cur.execute(
                                "INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES (%s, %s, NOW(), NOW()) RETURNING id;",
                                (clean_first, clean_last)
                            )
                            author_id = cur.fetchone()[0]

                        # Author Type
                        cur.execute("SELECT id FROM author_type WHERE LOWER(name) = LOWER(%s);", (author.role.lower(),))
                        at_row = cur.fetchone()
                        if at_row:
                            author_type_id = at_row[0]
                        else:
                            cur.execute("SELECT id FROM author_type LIMIT 1;")
                            author_type_id = cur.fetchone()[0]

                        # Link book and author
                        cur.execute(
                            """
                            INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at)
                            VALUES (%s, %s, %s, NOW(), NOW())
                            ON CONFLICT DO NOTHING;
                            """,
                            (book_id, author_id, author_type_id)
                        )

                conn.commit()
                return book_id

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error("Failed to upsert book '%s': %s", book.title, e)
            return None
        finally:
            if conn:
                self.return_connection(conn)

    def get_recent_books(self, limit: int = 15) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT b.id, b.title, b.isbn, b.volume, b.price, b.cover_url,
                           b.release_date, s.name as series_name, e.name as editor_name
                    FROM book b
                    LEFT JOIN series s ON b.series_id = s.id
                    LEFT JOIN editor e ON b.editor_id = e.id
                    ORDER BY b.id DESC
                    LIMIT %s;
                    """,
                    (limit,)
                )
                return [dict(r) for r in cur.fetchall()]
        except Exception as e:
            logger.error("Error fetching recent books: %s", e)
            return []
        finally:
            if conn:
                self.return_connection(conn)

db = Database(settings.DATABASE_URL)
