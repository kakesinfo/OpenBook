import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool

from config import settings
from scrapers.base import ScrapedBook, clean_text

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

    def repair_mojibake(self):
        """Repairs any existing corrupted double-encoded UTF-8 in the database."""
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

                # 5. Check if Book already exists (by ISBN or by Title)
                book_id = None
                if clean_isbn:
                    cur.execute("SELECT id FROM book WHERE isbn = %s;", (clean_isbn,))
                    row = cur.fetchone()
                    if row:
                        book_id = row[0]

                if not book_id:
                    cur.execute("SELECT id FROM book WHERE LOWER(title) = LOWER(%s);", (clean_title,))
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
                        clean_first = clean_text(author.firstname) or ""
                        clean_last = clean_text(author.lastname)
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
