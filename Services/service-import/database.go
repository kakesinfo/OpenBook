package main

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	_ "github.com/lib/pq"
)

var (
	reVolumeTome = regexp.MustCompile(`(?i)(?:^|[\s\-_])(?:tome|t|vol\.?|volume|#)\s*(\d+)`)
	reCleanSpace = regexp.MustCompile(`\s+`)
)

type Database struct {
	dbURL string
	mu    sync.Mutex
	pool  *sql.DB
}

func NewDatabase(dbURL string) *Database {
	return &Database{dbURL: dbURL}
}

func (d *Database) GetDB() (*sql.DB, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.pool != nil {
		return d.pool, nil
	}
	db, err := sql.Open("postgres", d.dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres database: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping postgres database: %w", err)
	}
	d.pool = db
	return d.pool, nil
}

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	s = reCleanSpace.ReplaceAllString(s, " ")
	return s
}

func splitAuthorName(fullName string) (string, string) {
	cleaned := cleanText(fullName)
	if cleaned == "" {
		return "", ""
	}
	parts := strings.Fields(cleaned)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return "", parts[0]
	}
	idx := strings.IndexFunc(cleaned, unicode.IsSpace)
	if idx == -1 {
		return "", cleaned
	}
	first := strings.TrimSpace(cleaned[:idx])
	last := strings.TrimSpace(cleaned[idx:])
	return first, last
}

func parseReleaseDate(pubDate string, createdAtMs int64) time.Time {
	pubDate = strings.TrimSpace(pubDate)
	if pubDate != "" {
		clean := strings.ReplaceAll(pubDate, "-", "/")
		parts := strings.Split(clean, "/")
		if len(parts) == 3 {
			if t, err := time.Parse("2006/01/02", clean); err == nil {
				return t
			}
		} else if len(parts) == 2 {
			if t, err := time.Parse("2006/01", clean); err == nil {
				return t
			}
		} else if len(parts) == 1 && len(clean) == 4 {
			if t, err := time.Parse("2006", clean); err == nil {
				return t
			}
		}
	}

	if createdAtMs > 0 {
		return time.UnixMilli(createdAtMs)
	}
	return time.Now()
}

func parseVolume(seriesNumber int, seriesNumberDecimal float64, title string) int {
	if seriesNumber > 0 {
		return seriesNumber
	}
	if seriesNumberDecimal > 0 {
		return int(math.Round(seriesNumberDecimal))
	}
	if m := reVolumeTome.FindStringSubmatch(title); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil && v > 0 {
			return v
		}
	}
	return 0
}

func (d *Database) FindOrCreateEditor(name string) (*int, error) {
	name = cleanText(name)
	if name == "" {
		return nil, nil
	}
	db, err := d.GetDB()
	if err != nil {
		return nil, err
	}

	var id int
	err = db.QueryRow("SELECT id FROM editor WHERE LOWER(name) = LOWER($1);", name).Scan(&id)
	if err == nil {
		return &id, nil
	}

	err = db.QueryRow("INSERT INTO editor (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id;", name).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (d *Database) FindOrCreateSeries(name string) (*int, error) {
	name = cleanText(name)
	if name == "" {
		return nil, nil
	}
	db, err := d.GetDB()
	if err != nil {
		return nil, err
	}

	var id int
	err = db.QueryRow("SELECT id FROM series WHERE LOWER(name) = LOWER($1);", name).Scan(&id)
	if err == nil {
		return &id, nil
	}

	// category_id=3 (Comics), status='ON_GOING'
	err = db.QueryRow("INSERT INTO series (name, status, category_id, created_at, updated_at) VALUES ($1, 'ON_GOING', 3, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id;", name).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (d *Database) FindOrCreateCollection(name string) (*int, error) {
	name = cleanText(name)
	if name == "" {
		return nil, nil
	}
	db, err := d.GetDB()
	if err != nil {
		return nil, err
	}

	var id int
	err = db.QueryRow("SELECT id FROM collection WHERE LOWER(name) = LOWER($1);", name).Scan(&id)
	if err == nil {
		return &id, nil
	}

	err = db.QueryRow("INSERT INTO collection (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id;", name).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (d *Database) FindOrCreateAuthor(fullName string) (int, error) {
	first, last := splitAuthorName(fullName)
	if last == "" {
		return 0, fmt.Errorf("empty author name")
	}
	db, err := d.GetDB()
	if err != nil {
		return 0, err
	}

	var id int
	err = db.QueryRow("SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2);", first, last).Scan(&id)
	if err == nil {
		return id, nil
	}

	err = db.QueryRow("INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id;", first, last).Scan(&id)
	if err != nil {
		err2 := db.QueryRow("SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2);", first, last).Scan(&id)
		if err2 == nil {
			return id, nil
		}
		return 0, err
	}
	return id, nil
}

func (d *Database) LinkBookAuthor(bookID int, authorID int, authorTypeID int) error {
	db, err := d.GetDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT DO NOTHING;
	`, bookID, authorID, authorTypeID)
	return err
}

func (d *Database) FindBook(isbn string, title string) (*ExistingBook, error) {
	db, err := d.GetDB()
	if err != nil {
		return nil, err
	}

	cleanISBN := strings.TrimSpace(isbn)
	cleanT := cleanText(title)

	selectCols := `
		SELECT id, title, isbn,
		       COALESCE(volume, 0), COALESCE(page_count, 0), COALESCE(price, 0),
		       description, cover_url,
		       COALESCE(release_date, '1970-01-01'::timestamp),
		       editor_id, series_id, collection_id,
		       COALESCE(type, '')
		FROM book
	`

	// 1. Match by normalized ISBN
	if cleanISBN != "" {
		digitsOnly := reBnfNonISBN.ReplaceAllString(cleanISBN, "")
		if digitsOnly != "" {
			var b ExistingBook
			q := selectCols + `
				WHERE regexp_replace(isbn, '[^0-9Xx]', '', 'g') = $1 AND isbn IS NOT NULL AND isbn != ''
				LIMIT 1;
			`
			err = db.QueryRow(q, digitsOnly).Scan(
				&b.ID, &b.Title, &b.ISBN, &b.Volume, &b.PageCount, &b.Price,
				&b.Description, &b.CoverURL, &b.ReleaseDate, &b.EditorID, &b.SeriesID, &b.CollectionID,
				&b.Type,
			)
			if err == nil {
				return &b, nil
			}
		}
	}

	// 2. Match by exact title (case-insensitive)
	if cleanT != "" {
		var b ExistingBook
		q := selectCols + `
			WHERE LOWER(title) = LOWER($1)
			LIMIT 1;
		`
		err = db.QueryRow(q, cleanT).Scan(
			&b.ID, &b.Title, &b.ISBN, &b.Volume, &b.PageCount, &b.Price,
			&b.Description, &b.CoverURL, &b.ReleaseDate, &b.EditorID, &b.SeriesID, &b.CollectionID,
			&b.Type,
		)
		if err == nil {
			return &b, nil
		}
	}

	// 3. Match by normalized alphanumeric title
	if cleanT != "" {
		var b ExistingBook
		q := selectCols + `
			WHERE regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')
			LIMIT 1;
		`
		err = db.QueryRow(q, cleanT).Scan(
			&b.ID, &b.Title, &b.ISBN, &b.Volume, &b.PageCount, &b.Price,
			&b.Description, &b.CoverURL, &b.ReleaseDate, &b.EditorID, &b.SeriesID, &b.CollectionID,
			&b.Type,
		)
		if err == nil {
			return &b, nil
		}
	}

	return nil, nil
}

// UpdateExistingBook updates an existing book's cover and information if different.
func (d *Database) UpdateExistingBook(
	existing *ExistingBook,
	b *BookmoryBook,
	newCoverURL string,
	editorID, seriesID *int,
	relDate time.Time,
	bookType string,
) (bool, error) {
	db, err := d.GetDB()
	if err != nil {
		return false, err
	}

	needsUpdate := false
	updates := make(map[string]any)

	// 1. Cover URL: update if backup provided a cover and it differs
	if newCoverURL != "" {
		currentCover := ""
		if existing.CoverURL != nil {
			currentCover = strings.TrimSpace(*existing.CoverURL)
		}
		if currentCover == "" || currentCover != newCoverURL {
			updates["cover_url"] = newCoverURL
			needsUpdate = true
		}
	}

	// 2. Description
	backupDesc := cleanText(b.Description)
	if backupDesc != "" {
		currentDesc := ""
		if existing.Description != nil {
			currentDesc = cleanText(*existing.Description)
		}
		if currentDesc == "" || (currentDesc != backupDesc && len(backupDesc) > len(currentDesc)) {
			updates["description"] = backupDesc
			needsUpdate = true
		}
	}

	// 3. Page count
	backupPages := int(b.RealTotalPage)
	if backupPages <= 0 {
		backupPages = int(b.TotalPage)
	}
	if backupPages > 0 && (existing.PageCount == 0 || existing.PageCount != backupPages) {
		updates["page_count"] = backupPages
		needsUpdate = true
	}

	// 4. Volume
	vol := parseVolume(b.SeriesNumber, b.SeriesNumberDecimal, b.Title)
	if vol > 0 && (existing.Volume == 0 || existing.Volume != vol) {
		updates["volume"] = vol
		needsUpdate = true
	}

	// 5. ISBN: update if missing in DB and backup has it
	cleanISBN := strings.TrimSpace(b.ISBN)
	if cleanISBN != "" {
		currentISBN := ""
		if existing.ISBN != nil {
			currentISBN = strings.TrimSpace(*existing.ISBN)
		}
		if currentISBN == "" {
			var otherID int
			if err := db.QueryRow("SELECT id FROM book WHERE isbn = $1 AND id != $2;", cleanISBN, existing.ID).Scan(&otherID); err != nil {
				updates["isbn"] = cleanISBN
				needsUpdate = true
			}
		}
	}

	// 6. Editor
	if editorID != nil && existing.EditorID == nil {
		updates["editor_id"] = *editorID
		needsUpdate = true
	}

	// 7. Series
	if seriesID != nil && existing.SeriesID == nil {
		updates["series_id"] = *seriesID
		needsUpdate = true
	}

	// 8. Price
	backupPrice := 0
	if len(b.Purchases) > 0 && b.Purchases[0].Price > 0 {
		backupPrice = int(math.Round(b.Purchases[0].Price))
	}
	if backupPrice > 0 && (existing.Price == 0 || existing.Price != backupPrice) {
		updates["price"] = backupPrice
		needsUpdate = true
	}

	// 9. Release date
	if !relDate.IsZero() && existing.ReleaseDate.IsZero() {
		updates["release_date"] = relDate
		needsUpdate = true
	}

	// 10. Type
	if bookType != "" && existing.Type != bookType {
		if existing.Type == "" || (existing.Type == "Comics" && bookType != "Comics") || (existing.Type == "Roman" && (bookType == "Comics" || bookType == "Bande dessinée" || bookType == "Manga")) {
			updates["type"] = bookType
			needsUpdate = true
		}
	}

	if !needsUpdate {
		return false, nil
	}

	// Build dynamic UPDATE query
	setClauses := []string{"updated_at = NOW()"}
	args := []any{existing.ID}
	argIdx := 2

	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, argIdx))
		args = append(args, val)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE book SET %s WHERE id = $1;", strings.Join(setClauses, ", "))
	_, err = db.Exec(query, args...)
	if err != nil {
		return false, fmt.Errorf("failed to update book %d: %w", existing.ID, err)
	}

	return true, nil
}

// CreateNewBook creates a new book in the database from Bookmory backup data.
func (d *Database) CreateNewBook(
	b *BookmoryBook,
	coverURL string,
	editorID, seriesID *int,
	relDate time.Time,
	bookType string,
) (int, error) {
	db, err := d.GetDB()
	if err != nil {
		return 0, err
	}

	cleanT := cleanText(b.Title)
	if cleanT == "" {
		return 0, fmt.Errorf("book title cannot be empty")
	}

	cleanISBN := strings.TrimSpace(b.ISBN)
	if cleanISBN != "" {
		var existingID int
		if err := db.QueryRow("SELECT id FROM book WHERE isbn = $1;", cleanISBN).Scan(&existingID); err == nil {
			log.Printf("[Database] ISBN %s already exists on book %d; omitting for new book '%s'", cleanISBN, existingID, cleanT)
			cleanISBN = ""
		}
	}

	vol := parseVolume(b.SeriesNumber, b.SeriesNumberDecimal, cleanT)
	pages := int(b.RealTotalPage)
	if pages <= 0 {
		pages = int(b.TotalPage)
	}

	price := 0
	if len(b.Purchases) > 0 && b.Purchases[0].Price > 0 {
		price = int(math.Round(b.Purchases[0].Price))
	}

	desc := cleanText(b.Description)
	bType := bookType
	if bType == "" {
		bType = "Comics"
	}

	var bookID int
	query := `
		INSERT INTO book (
			title, series_id, editor_id, collection_id,
			volume, isbn, page_count, price, description,
			cover_url, release_date, type, created_at, updated_at
		) VALUES (
			$1, $2, $3, NULL,
			$4, NULLIF($5, ''), $6, $7, NULLIF($8, ''),
			NULLIF($9, ''), $10, $11, NOW(), NOW()
		) RETURNING id;
	`

	err = db.QueryRow(
		query,
		cleanT, seriesID, editorID,
		vol, cleanISBN, pages, price, desc,
		coverURL, relDate, bType,
	).Scan(&bookID)

	if err != nil {
		// If duplicate title or ISBN collision occurs, match existing book and update it
		if strings.Contains(err.Error(), "book_title_key") || strings.Contains(err.Error(), "book_isbn_key") {
			existing, fErr := d.FindBook(cleanISBN, cleanT)
			if fErr == nil && existing != nil {
				_, _ = d.UpdateExistingBook(existing, b, coverURL, editorID, seriesID, relDate, bType)
				return existing.ID, nil
			}
		}
		return 0, fmt.Errorf("failed to insert book '%s': %w", cleanT, err)
	}

	return bookID, nil
}

func (d *Database) UpsertUserOwnsBook(userID int, bookID int, wishlist bool) error {
	db, err := d.GetDB()
	if err != nil {
		return err
	}
	status := "OWNED"
	if wishlist {
		status = "WISHLISTED"
	}
	_, err = db.Exec(`
		INSERT INTO user_owns_book (user_id, book_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
	`, userID, bookID, status)
	return err
}

func (d *Database) UpsertBookStatus(userID int, bookID int, status string) error {
	db, err := d.GetDB()
	if err != nil {
		return err
	}
	cleanStatus := strings.ToUpper(strings.TrimSpace(status))
	if cleanStatus == "" {
		cleanStatus = "UNREAD"
	}
	_, err = db.Exec(`
		INSERT INTO book_status (user_id, book_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();
	`, userID, bookID, cleanStatus)
	return err
}

func (d *Database) ImportPurchase(userID int, bookID int, p *BookmoryPurchase) (bool, error) {
	if p == nil {
		return false, nil
	}
	db, err := d.GetDB()
	if err != nil {
		return false, err
	}

	txDate := time.Now().Format("2006-01-02")
	if p.PurchasedAt > 0 {
		txDate = time.UnixMilli(p.PurchasedAt).Format("2006-01-02")
	} else if p.CreatedAt > 0 {
		txDate = time.UnixMilli(p.CreatedAt).Format("2006-01-02")
	}

	price := p.Price
	location := cleanText(p.From)
	memo := cleanText(p.Memo)

	// Check if already exists to prevent duplicate transactions
	var exists int
	err = db.QueryRow(`
		SELECT 1 FROM user_book_transaction
		WHERE user_id = $1 AND book_id = $2 AND type = 'BOUGHT'
		  AND transaction_date = $3::date AND price = $4
		LIMIT 1;
	`, userID, bookID, txDate, price).Scan(&exists)

	if err == nil {
		return false, nil // Already imported
	}

	_, err = db.Exec(`
		INSERT INTO user_book_transaction (
			user_id, book_id, type, transaction_date, price, location, memo, created_at, updated_at
		) VALUES (
			$1, $2, 'BOUGHT', $3::date, $4, NULLIF($5, ''), NULLIF($6, ''), NOW(), NOW()
		);
	`, userID, bookID, txDate, price, location, memo)

	if err != nil {
		return false, fmt.Errorf("failed to insert purchase: %w", err)
	}
	return true, nil
}

func (d *Database) ImportReadingSession(userID int, bookID int, timer *BookmoryReadTimer, page int) (bool, error) {
	if timer == nil || timer.ElapsedSec <= 0 {
		return false, nil
	}
	db, err := d.GetDB()
	if err != nil {
		return false, err
	}

	minutesRead := timer.ElapsedSec / 60
	secondsRead := timer.ElapsedSec % 60
	sessionTime := time.Now()
	if timer.ReadStartedAt > 0 {
		sessionTime = time.UnixMilli(timer.ReadStartedAt)
	} else if timer.CreatedAt > 0 {
		sessionTime = time.UnixMilli(timer.CreatedAt)
	}

	// Check duplicate session
	var exists int
	err = db.QueryRow(`
		SELECT 1 FROM reading_session
		WHERE user_id = $1 AND book_id = $2 AND created_at = $3
		LIMIT 1;
	`, userID, bookID, sessionTime).Scan(&exists)

	if err == nil {
		return false, nil // Already imported
	}

	_, err = db.Exec(`
		INSERT INTO reading_session (
			user_id, book_id, current_page, minutes_read, seconds_read, session_type, created_at
		) VALUES (
			$1, $2, $3, $4, $5, 1, $6
		);
	`, userID, bookID, page, minutesRead, secondsRead, sessionTime)

	if err != nil {
		return false, fmt.Errorf("failed to insert reading session: %w", err)
	}
	return true, nil
}
