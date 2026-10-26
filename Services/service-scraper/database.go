package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"
	"yet-another-library/service-scraper/scrapers"
)

var (
	reCoverURLISBN = regexp.MustCompile(`/(?:album|principal|prod|cache/[^/]+/[^/]+)/([0-9]{10,13})`)
	bogusTitlesMap = map[string]bool{
		"nos univers":               true,
		"bronze books":              true,
		"universal monsters":        true,
		"adaptations littéraires":   true,
		"la philo en bd":            true,
		"l'école des loisirs en bd": true,
		"pierre lemaitre":           true,
	}
)

type queryExecer interface {
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	Exec(query string, args ...any) (sql.Result, error)
}

func OptimizeCoverToMediaService(remoteURL string) string {
	if remoteURL == "" || !strings.HasPrefix(remoteURL, "http") {
		return remoteURL
	}
	mediaURL := settings.MediaServiceURL
	client4s := &http.Client{Timeout: 4 * time.Second}
	resp, err := client4s.Post(fmt.Sprintf("%s/images", mediaURL), "application/json", nil)
	if err != nil {
		return remoteURL
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		var slot struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&slot); err == nil && slot.ID != "" {
			payload, _ := json.Marshal(map[string]string{"url": remoteURL})
			client30s := &http.Client{Timeout: 30 * time.Second}
			upResp, upErr := client30s.Post(fmt.Sprintf("%s/images/%s", mediaURL, slot.ID), "application/json", bytes.NewReader(payload))
			if upErr == nil {
				upResp.Body.Close()
				if upResp.StatusCode == http.StatusOK {
					return slot.ID
				}
			}
		}
	}
	return remoteURL
}

type Database struct {
	dbURL string
	mu    sync.Mutex
	pool  *sql.DB
}

var db = NewDatabase(settings.DatabaseURL)

func NewDatabase(dbURL string) *Database {
	return &Database{dbURL: dbURL}
}

func (d *Database) getDB() (*sql.DB, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.pool != nil {
		return d.pool, nil
	}
	sqlDB, err := sql.Open("postgres", d.dbURL)
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	d.pool = sqlDB
	return d.pool, nil
}

func (d *Database) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.pool != nil {
		_ = d.pool.Close()
		d.pool = nil
	}
}

func (d *Database) CheckConnection() bool {
	sqlDB, err := d.getDB()
	if err != nil {
		log.Printf("Database connection check failed: %v", err)
		return false
	}
	var one int
	if err := sqlDB.QueryRow("SELECT 1;").Scan(&one); err != nil {
		log.Printf("Database connection check failed: %v", err)
		return false
	}
	return true
}

func (d *Database) RepairAuthors(qe queryExecer) error {
	var tx *sql.Tx
	if qe == nil {
		sqlDB, err := d.getDB()
		if err != nil {
			return err
		}
		tx, err = sqlDB.Begin()
		if err != nil {
			return err
		}
		defer func() {
			if tx != nil {
				_ = tx.Rollback()
			}
		}()
		qe = tx
	}

	rows, err := qe.Query("SELECT id, COALESCE(firstname, ''), COALESCE(lastname, '') FROM author;")
	if err != nil {
		return err
	}
	type authorRow struct {
		id    int
		fname string
		lname string
	}
	var authors []authorRow
	for rows.Next() {
		var a authorRow
		if err := rows.Scan(&a.id, &a.fname, &a.lname); err == nil {
			authors = append(authors, a)
		}
	}
	rows.Close()

	for _, a := range authors {
		rawFull := a.lname
		if a.fname != "" {
			rawFull = strings.TrimSpace(fmt.Sprintf("%s %s", a.fname, a.lname))
		}
		cleanFull := scrapers.CleanAuthorName(rawFull)
		if cleanFull != rawFull {
			cFname, cLname := scrapers.SplitAuthorName(cleanFull)
			var targetID int
			err := qe.QueryRow(
				"SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2) AND id != $3;",
				cFname, cLname, a.id,
			).Scan(&targetID)
			if err == nil {
				_, _ = qe.Exec(`
					DELETE FROM book_has_author
					WHERE author_id = $1
					  AND book_id IN (SELECT book_id FROM book_has_author WHERE author_id = $2);
				`, a.id, targetID)
				_, _ = qe.Exec("UPDATE book_has_author SET author_id = $1 WHERE author_id = $2;", targetID, a.id)
				_, _ = qe.Exec("DELETE FROM author WHERE id = $1;", a.id)
			} else {
				_, _ = qe.Exec("UPDATE author SET firstname = $1, lastname = $2 WHERE id = $3;", cFname, cLname, a.id)
			}
		}
	}

	_, err = qe.Exec(`
		DELETE FROM book_has_author a USING book_has_author b
		WHERE a.ctid < b.ctid
		  AND a.book_id = b.book_id
		  AND a.author_id = b.author_id
		  AND a.author_type_id = b.author_type_id;
	`)
	if err != nil {
		return err
	}

	if tx != nil {
		if err := tx.Commit(); err != nil {
			return err
		}
		tx = nil
	}
	return nil
}

func (d *Database) DeduplicateBooks(qe queryExecer) (int, error) {
	var tx *sql.Tx
	if qe == nil {
		sqlDB, err := d.getDB()
		if err != nil {
			return 0, err
		}
		tx, err = sqlDB.Begin()
		if err != nil {
			return 0, err
		}
		defer func() {
			if tx != nil {
				_ = tx.Rollback()
			}
		}()
		qe = tx
	}

	rows, err := qe.Query(`
		SELECT b1.id, b2.id, COALESCE(b1.title, ''), COALESCE(b2.title, ''),
		       COALESCE(b1.isbn, ''), COALESCE(b2.isbn, ''),
		       COALESCE(b1.cover_url, ''), COALESCE(b2.cover_url, ''),
		       COALESCE(b1.description, ''), COALESCE(b2.description, '')
		FROM book b1
		JOIN book b2 ON b1.id < b2.id AND b1.editor_id = b2.editor_id
		WHERE (b1.cover_url IS NOT NULL AND b1.cover_url != '' AND b1.cover_url = b2.cover_url)
		   OR (b1.isbn IS NOT NULL AND b1.isbn != '' AND b1.isbn = b2.isbn)
		   OR (regexp_replace(lower(b1.title), '[^a-z0-9]', '', 'g') = regexp_replace(lower(b2.title), '[^a-z0-9]', '', 'g'));
	`)
	if err != nil {
		return 0, err
	}

	type dupPair struct {
		id1, id2     int
		t1, t2       string
		isbn1, isbn2 string
		c1, c2       string
		d1, d2       string
	}
	var pairs []dupPair
	for rows.Next() {
		var p dupPair
		if err := rows.Scan(&p.id1, &p.id2, &p.t1, &p.t2, &p.isbn1, &p.isbn2, &p.c1, &p.c2, &p.d1, &p.d2); err == nil {
			pairs = append(pairs, p)
		}
	}
	rows.Close()

	mergedCount := 0
	handledDrops := make(map[int]bool)

	for _, p := range pairs {
		if handledDrops[p.id1] || handledDrops[p.id2] {
			continue
		}

		if p.c1 != p.c2 && (p.isbn1 != p.isbn2 || p.isbn1 == "") {
			if strings.Contains(strings.ToLower(p.t1), "nanarland") || scrapers.IsVariantTitle(p.t1) || scrapers.IsVariantTitle(p.t2) {
				continue
			}
		}

		t1Bogus := bogusTitlesMap[strings.ToLower(strings.TrimSpace(p.t1))]
		t2Bogus := bogusTitlesMap[strings.ToLower(strings.TrimSpace(p.t2))]

		var keepID, dropID int
		var keepISBN, dropISBN, keepDesc, dropDesc string

		switch {
		case t1Bogus && !t2Bogus:
			keepID, dropID = p.id2, p.id1
			keepISBN, dropISBN = p.isbn2, p.isbn1
			keepDesc, dropDesc = p.d2, p.d1
		case t2Bogus && !t1Bogus:
			keepID, dropID = p.id1, p.id2
			keepISBN, dropISBN = p.isbn1, p.isbn2
			keepDesc, dropDesc = p.d1, p.d2
		case p.isbn1 != "" && p.isbn2 == "":
			keepID, dropID = p.id1, p.id2
			keepISBN, dropISBN = p.isbn1, p.isbn2
			keepDesc, dropDesc = p.d1, p.d2
		case p.isbn2 != "" && p.isbn1 == "":
			keepID, dropID = p.id2, p.id1
			keepISBN, dropISBN = p.isbn2, p.isbn1
			keepDesc, dropDesc = p.d2, p.d1
		case len([]rune(p.t1)) >= len([]rune(p.t2)):
			keepID, dropID = p.id1, p.id2
			keepISBN, dropISBN = p.isbn1, p.isbn2
			keepDesc, dropDesc = p.d1, p.d2
		default:
			keepID, dropID = p.id2, p.id1
			keepISBN, dropISBN = p.isbn2, p.isbn1
			keepDesc, dropDesc = p.d2, p.d1
		}

		handledDrops[dropID] = true

		if keepISBN == "" && dropISBN != "" {
			_, _ = qe.Exec("UPDATE book SET isbn = $1 WHERE id = $2;", dropISBN, keepID)
		}
		if keepDesc == "" && dropDesc != "" {
			_, _ = qe.Exec("UPDATE book SET description = $1 WHERE id = $2;", dropDesc, keepID)
		}

		// 2. Re-point user_owns_book
		_, _ = qe.Exec(`
			DELETE FROM user_owns_book
			WHERE book_id = $1
			  AND user_id IN (SELECT user_id FROM user_owns_book WHERE book_id = $2);
		`, dropID, keepID)
		_, _ = qe.Exec("UPDATE user_owns_book SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 3. Re-point book_status
		_, _ = qe.Exec(`
			DELETE FROM book_status
			WHERE book_id = $1
			  AND user_id IN (SELECT user_id FROM book_status WHERE book_id = $2);
		`, dropID, keepID)
		_, _ = qe.Exec("UPDATE book_status SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 4. Re-point reading_session
		_, _ = qe.Exec("UPDATE reading_session SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 5. Re-point book_has_author
		_, _ = qe.Exec(`
			DELETE FROM book_has_author
			WHERE book_id = $1
			  AND author_id IN (SELECT author_id FROM book_has_author WHERE book_id = $2);
		`, dropID, keepID)
		_, _ = qe.Exec("UPDATE book_has_author SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 6. Re-point book_has_theme
		_, _ = qe.Exec(`
			DELETE FROM book_has_theme
			WHERE book_id = $1
			  AND theme_id IN (SELECT theme_id FROM book_has_theme WHERE book_id = $2);
		`, dropID, keepID)
		_, _ = qe.Exec("UPDATE book_has_theme SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 7. Re-point book_has_image
		_, _ = qe.Exec("UPDATE book_has_image SET book_id = $1 WHERE book_id = $2;", keepID, dropID)

		// 8. Delete duplicate book
		_, _ = qe.Exec("DELETE FROM book WHERE id = $1;", dropID)
		mergedCount++
	}

	if tx != nil {
		if err := tx.Commit(); err != nil {
			return 0, err
		}
		tx = nil
	}
	if mergedCount > 0 {
		log.Printf("Deduplicated and merged %d redundant book records.", mergedCount)
	}
	return mergedCount, nil
}

func (d *Database) RepairMojibake() (map[string]any, error) {
	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	// 1. Repair books
	rows, err := tx.Query("SELECT id, COALESCE(title, ''), COALESCE(description, '') FROM book WHERE title ~ '[ÃÂ]' OR description ~ '[ÃÂ]';")
	if err != nil {
		return nil, err
	}
	type bRow struct {
		id          int
		title, desc string
	}
	var books []bRow
	for rows.Next() {
		var b bRow
		if err := rows.Scan(&b.id, &b.title, &b.desc); err == nil {
			books = append(books, b)
		}
	}
	rows.Close()

	for _, b := range books {
		newTitle := scrapers.CleanText(b.title)
		newDesc := scrapers.CleanText(b.desc)
		_, _ = tx.Exec("UPDATE book SET title = $1, description = $2 WHERE id = $3;", newTitle, newDesc, b.id)
	}
	repairedBooks := len(books)

	// 2. Repair series
	sRows, err := tx.Query("SELECT id, COALESCE(name, '') FROM series WHERE name ~ '[ÃÂ]';")
	if err != nil {
		return nil, err
	}
	type sRow struct {
		id   int
		name string
	}
	var series []sRow
	for sRows.Next() {
		var s sRow
		if err := sRows.Scan(&s.id, &s.name); err == nil {
			series = append(series, s)
		}
	}
	sRows.Close()

	for _, s := range series {
		newName := scrapers.CleanText(s.name)
		var targetID int
		if err := tx.QueryRow("SELECT id FROM series WHERE name = $1 AND id != $2;", newName, s.id).Scan(&targetID); err == nil {
			_, _ = tx.Exec("UPDATE book SET series_id = $1 WHERE series_id = $2;", targetID, s.id)
			_, _ = tx.Exec("DELETE FROM series_has_theme WHERE series_id = $1;", s.id)
			_, _ = tx.Exec("DELETE FROM series WHERE id = $1;", s.id)
		} else {
			_, _ = tx.Exec("UPDATE series SET name = $1 WHERE id = $2;", newName, s.id)
		}
	}
	repairedSeries := len(series)

	// 3. Purge bogus scraper authors
	_, _ = tx.Exec(`
		DELETE FROM book_has_author
		WHERE author_id IN (
			SELECT id FROM author WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs')
		);
	`)
	_, _ = tx.Exec(`
		DELETE FROM author
		WHERE LOWER(lastname) IN ('interviews', 'portfolio', 'auteurs');
	`)

	// 4. Repair & consolidate corrupted author names
	if err := d.RepairAuthors(tx); err != nil {
		return nil, err
	}

	// 5. Merge duplicates
	mergedDuplicates, err := d.DeduplicateBooks(tx)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil

	if repairedBooks > 0 || repairedSeries > 0 {
		log.Printf("Repaired %d books and %d series corrupted by mojibake.", repairedBooks, repairedSeries)
	}

	return map[string]any{
		"repaired_books":    repairedBooks,
		"repaired_series":   repairedSeries,
		"merged_duplicates": mergedDuplicates,
	}, nil
}

func (d *Database) GetMaintenanceStats() map[string]any {
	sqlDB, err := d.getDB()
	if err != nil {
		return map[string]any{
			"total_books":   0,
			"total_series":  0,
			"total_editors": 0,
			"total_authors": 0,
			"url_covers":    0,
		}
	}
	var totalBooks, totalSeries, totalEditors, totalAuthors, urlCovers int
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM book;").Scan(&totalBooks)
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM series;").Scan(&totalSeries)
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM editor;").Scan(&totalEditors)
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM author;").Scan(&totalAuthors)
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM book WHERE cover_url ~* '^https?://';").Scan(&urlCovers)

	return map[string]any{
		"total_books":   totalBooks,
		"total_series":  totalSeries,
		"total_editors": totalEditors,
		"total_authors": totalAuthors,
		"url_covers":    urlCovers,
	}
}

func (d *Database) MigrateCoversToUUID(limit *int, maxWorkers int) map[string]any {
	if maxWorkers <= 0 {
		maxWorkers = 8
	}
	sqlDB, err := d.getDB()
	if err != nil {
		return map[string]any{"status": "error", "message": err.Error(), "total": 0, "migrated": 0, "errors": 0}
	}

	query := "SELECT id, COALESCE(title, ''), COALESCE(cover_url, '') FROM book WHERE cover_url ~* '^https?://' ORDER BY id ASC"
	if limit != nil && *limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", *limit)
	}

	rows, err := sqlDB.Query(query)
	if err != nil {
		return map[string]any{"status": "error", "message": err.Error(), "total": 0, "migrated": 0, "errors": 0}
	}
	type cand struct {
		id       int
		title    string
		coverURL string
	}
	var candidates []cand
	for rows.Next() {
		var c cand
		if err := rows.Scan(&c.id, &c.title, &c.coverURL); err == nil {
			candidates = append(candidates, c)
		}
	}
	rows.Close()

	if len(candidates) == 0 {
		return map[string]any{
			"status":    "success",
			"message":   "Toutes les couvertures sont déjà sous forme d'UUID ! Aucune URL externe à migrer.",
			"total":     0,
			"migrated":  0,
			"errors":    0,
			"remaining": 0,
		}
	}

	log.Printf("Migrating %d book cover URLs to UUIDs...", len(candidates))

	type updateItem struct {
		id    int
		cover string
	}
	var (
		updates       []updateItem
		migratedCount int
		errorCount    int
		mu            sync.Mutex
		wg            sync.WaitGroup
		ch            = make(chan cand, len(candidates))
	)

	for _, c := range candidates {
		ch <- c
	}
	close(ch)

	for w := 0; w < maxWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for c := range ch {
				uuidVal := OptimizeCoverToMediaService(c.coverURL)
				mu.Lock()
				if uuidVal != "" && uuidVal != c.coverURL && !strings.HasPrefix(uuidVal, "http") {
					updates = append(updates, updateItem{id: c.id, cover: uuidVal})
					migratedCount++
				} else {
					errorCount++
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	if len(updates) > 0 {
		tx, err := sqlDB.Begin()
		if err == nil {
			for _, u := range updates {
				_, _ = tx.Exec("UPDATE book SET cover_url = $1, updated_at = NOW() WHERE id = $2;", u.cover, u.id)
			}
			_ = tx.Commit()
		}
	}

	remaining := 0
	_ = sqlDB.QueryRow("SELECT COUNT(*) FROM book WHERE cover_url ~* '^https?://';").Scan(&remaining)

	msg := fmt.Sprintf("Migration terminée : %d couverture(s) migrée(s) en UUID.", migratedCount)
	if errorCount > 0 {
		msg += fmt.Sprintf(" (%d erreur(s) ou image(s) inaccessible(s))", errorCount)
	}
	if remaining > 0 {
		msg += fmt.Sprintf(" - %d restante(s).", remaining)
	}

	return map[string]any{
		"status":    "success",
		"message":   msg,
		"total":     len(candidates),
		"migrated":  migratedCount,
		"errors":    errorCount,
		"remaining": remaining,
	}
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableIntPtr(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func (d *Database) UpsertBook(book *scrapers.ScrapedBook) *int {
	sqlDB, err := d.getDB()
	if err != nil {
		log.Printf("Error upserting book '%s': %v", book.Title, err)
		return nil
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		log.Printf("Error starting tx for book '%s': %v", book.Title, err)
		return nil
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	// 1. Clean strings
	cleanTitle := scrapers.CleanText(book.Title)
	seriesFallback := book.SeriesName
	if seriesFallback == "" {
		seriesFallback = book.Title
	}
	cleanSeriesName := scrapers.CleanText(seriesFallback)
	cleanEditorName := scrapers.CleanText(book.EditorName)
	cleanDesc := scrapers.CleanText(book.Description)
	cleanISBN := strings.TrimSpace(book.ISBN)

	if cleanISBN == "" && book.CoverURL != "" {
		if m := reCoverURLISBN.FindStringSubmatch(book.CoverURL); len(m) > 1 {
			cleanISBN = m[1]
		}
	}

	// 2. Editor
	var editorID *int
	if cleanEditorName != "" {
		var eid int
		err := tx.QueryRow("SELECT id FROM editor WHERE LOWER(name) = LOWER($1);", cleanEditorName).Scan(&eid)
		if err == nil {
			editorID = &eid
		} else {
			if err := tx.QueryRow("INSERT INTO editor (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id;", cleanEditorName).Scan(&eid); err == nil {
				editorID = &eid
			}
		}
	}

	// 3. Category
	categoryID := 3
	catName := scrapers.CleanText(book.CategoryName)
	if catName == "" {
		catName = "Comics"
	}
	if err := tx.QueryRow("SELECT id FROM category WHERE LOWER(name) = LOWER($1);", catName).Scan(&categoryID); err != nil {
		_ = tx.QueryRow("SELECT id FROM category WHERE name = 'Comics';").Scan(&categoryID)
	}

	// 4. Collection
	var collectionID *int
	cleanColName := scrapers.CleanText(book.CollectionName)
	if cleanColName != "" {
		var cid int
		if err := tx.QueryRow("SELECT id FROM collection WHERE LOWER(name) = LOWER($1);", cleanColName).Scan(&cid); err == nil {
			collectionID = &cid
		} else if err := tx.QueryRow("INSERT INTO collection (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id;", cleanColName).Scan(&cid); err == nil {
			collectionID = &cid
		}
	}

	// 5. Extract canonical volume if needed
	_, canonVol := scrapers.ExtractCanonicalSeriesAndVolume(cleanTitle)
	if (book.Volume == nil || *book.Volume == 0) && canonVol != nil {
		book.Volume = canonVol
	}

	incomingIsVariant := scrapers.IsVariantBook(cleanTitle, book.CoverURL, "") || book.IsVariant
	parentBookID := book.ParentBookID
	if parentBookID == nil && incomingIsVariant && editorID != nil {
		baseTitle := scrapers.StripVariantSuffix(cleanTitle)
		var candID int
		var candTitle string
		err := tx.QueryRow(`
			SELECT id, title FROM book
			WHERE editor_id = $1
			  AND (parent_book_id IS NULL OR parent_book_id = 0)
			  AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower($2), '[^a-z0-9]', '', 'g')
			ORDER BY id ASC
			LIMIT 1;
		`, *editorID, baseTitle).Scan(&candID, &candTitle)
		if err == nil && !scrapers.IsVariantBook(candTitle, "", "") {
			parentBookID = &candID
		} else if book.Volume != nil && *book.Volume > 0 {
			pRows, pErr := tx.Query(`
				SELECT id, COALESCE(title, '') FROM book
				WHERE editor_id = $1 AND volume = $2
				  AND (parent_book_id IS NULL OR parent_book_id = 0)
				ORDER BY id ASC;
			`, *editorID, *book.Volume)
			if pErr == nil {
				for pRows.Next() {
					var pID int
					var pTitle string
					if pRows.Scan(&pID, &pTitle) == nil {
						if !scrapers.IsVariantBook(pTitle, "", "") {
							pClean := strings.ToLower(scrapers.StripVariantSuffix(scrapers.CleanText(pTitle)))
							lowClean := strings.ToLower(cleanTitle)
							lowBase := strings.ToLower(baseTitle)
							if strings.Contains(lowClean, pClean) || strings.Contains(pClean, lowBase) {
								idCopy := pID
								parentBookID = &idCopy
								break
							}
						}
					}
				}
				pRows.Close()
			}
		}
	}

	// BNF enrichment if ISBN is missing
	if cleanISBN == "" {
		bnfData := SearchBnfBook(cleanTitle, cleanSeriesName, cleanEditorName, book.Volume, incomingIsVariant, 8)
		if bnfData != nil && bnfData.ISBN != "" {
			cleanISBN = bnfData.ISBN
			book.ISBN = cleanISBN
			if book.PageCount == 0 && bnfData.PageCount != nil {
				book.PageCount = *bnfData.PageCount
			}
			if collectionID == nil && bnfData.CollectionName != "" {
				cleanCol := scrapers.CleanText(bnfData.CollectionName)
				var cid int
				if err := tx.QueryRow("SELECT id FROM collection WHERE LOWER(name) = LOWER($1);", cleanCol).Scan(&cid); err == nil {
					collectionID = &cid
				} else if err := tx.QueryRow("INSERT INTO collection (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id;", cleanCol).Scan(&cid); err == nil {
					collectionID = &cid
				}
			}
			if len(book.Authors) == 0 && len(bnfData.Authors) > 0 {
				book.Authors = bnfData.Authors
			}
			if book.ReleaseDate == nil && bnfData.ReleaseDate != nil {
				book.ReleaseDate = bnfData.ReleaseDate
			}
			log.Printf("Enriched book '%s' via BNF: ISBN=%s, pages=%d", cleanTitle, cleanISBN, book.PageCount)
		}
	}

	// Check if Book already exists (Multi-criteria matching)
	var bookID *int

	// Criterion A: ISBN match
	if cleanISBN != "" {
		var bid int
		if err := tx.QueryRow("SELECT id FROM book WHERE isbn = $1;", cleanISBN).Scan(&bid); err == nil {
			bookID = &bid
		}
	}

	// Criterion B: Identical cover URL for same editor
	if bookID == nil && book.CoverURL != "" && editorID != nil {
		var bid int
		if err := tx.QueryRow("SELECT id FROM book WHERE cover_url = $1 AND editor_id = $2;", book.CoverURL, *editorID).Scan(&bid); err == nil {
			bookID = &bid
		}
	}

	// Criterion C: Normalized title match
	if bookID == nil && cleanTitle != "" && editorID != nil {
		var bid int
		if err := tx.QueryRow(`
			SELECT id FROM book
			WHERE editor_id = $1
			  AND regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = regexp_replace(lower($2), '[^a-z0-9]', '', 'g')
			LIMIT 1;
		`, *editorID, cleanTitle).Scan(&bid); err == nil {
			bookID = &bid
		}
	}

	// Criterion D: Volume and base title match for same editor
	if bookID == nil && editorID != nil && book.Volume != nil && *book.Volume > 0 {
		baseClean := strings.ToLower(scrapers.StripVariantSuffix(cleanTitle))
		cRows, cErr := tx.Query("SELECT id, COALESCE(title, '') FROM book WHERE editor_id = $1 AND volume = $2 ORDER BY id ASC;", *editorID, *book.Volume)
		if cErr == nil {
			for cRows.Next() {
				var candID int
				var candTitle string
				if cRows.Scan(&candID, &candTitle) == nil {
					candIsVariant := scrapers.IsVariantBook(candTitle, "", "")
					if incomingIsVariant == candIsVariant {
						if strings.EqualFold(scrapers.CleanText(candTitle), cleanTitle) || strings.ToLower(scrapers.StripVariantSuffix(candTitle)) == baseClean {
							idCopy := candID
							bookID = &idCopy
							break
						}
					}
				}
			}
			cRows.Close()
		}
	}

	storedCover := OptimizeCoverToMediaService(book.CoverURL)

	if bookID != nil {
		if parentBookID != nil && *parentBookID == *bookID {
			parentBookID = nil
		}

		_, err = tx.Exec(`
			UPDATE book
			SET updated_at = NOW(),
			    price = COALESCE(NULLIF($1, 0), price),
			    page_count = COALESCE(NULLIF($2, 0), page_count),
			    release_date = COALESCE($3, release_date),
			    description = COALESCE($4, description),
			    cover_url = COALESCE($5, cover_url),
			    collection_id = COALESCE($6, collection_id),
			    parent_book_id = CASE
			        WHEN $7::int IS NOT NULL AND $7::int != id THEN $7::int
			        WHEN parent_book_id = id THEN NULL
			        ELSE parent_book_id
			    END
			WHERE id = $8;
		`,
			book.Price,
			book.PageCount,
			book.ReleaseDate,
			nullableString(cleanDesc),
			nullableString(storedCover),
			nullableIntPtr(collectionID),
			nullableIntPtr(parentBookID),
			*bookID,
		)
		if err != nil {
			log.Printf("Error updating book '%s': %v", cleanTitle, err)
			return nil
		}

		if cleanISBN != "" {
			var existingOther int
			if err := tx.QueryRow("SELECT id FROM book WHERE isbn = $1 AND id != $2;", cleanISBN, *bookID).Scan(&existingOther); err != nil {
				_, _ = tx.Exec("UPDATE book SET isbn = $1 WHERE id = $2 AND (isbn IS NULL OR isbn = '');", cleanISBN, *bookID)
			} else {
				log.Printf("ISBN %s already assigned to another book; skipping ISBN update for book %d", cleanISBN, *bookID)
			}
		}

		var currTitle string
		if err := tx.QueryRow("SELECT COALESCE(title, '') FROM book WHERE id = $1;", *bookID).Scan(&currTitle); err == nil && currTitle != "" {
			currLow := strings.ToLower(strings.TrimSpace(currTitle))
			cleanLow := strings.ToLower(strings.TrimSpace(cleanTitle))
			if bogusTitlesMap[currLow] || (len([]rune(cleanTitle)) > len([]rune(currTitle)) && !bogusTitlesMap[cleanLow]) {
				_, _ = tx.Exec("UPDATE book SET title = $1 WHERE id = $2;", cleanTitle, *bookID)
			}
		}
	} else {
		if cleanISBN != "" {
			var existingID int
			if err := tx.QueryRow("SELECT id FROM book WHERE isbn = $1;", cleanISBN).Scan(&existingID); err == nil {
				log.Printf("ISBN %s already taken by an existing book; inserting new book without ISBN", cleanISBN)
				cleanISBN = ""
			}
		}

		volVal := 1
		if book.Volume != nil && *book.Volume > 0 {
			volVal = *book.Volume
		}
		relDate := time.Now()
		if book.ReleaseDate != nil {
			relDate = *book.ReleaseDate
		}
		bType := book.BookType
		if bType == "" {
			bType = "Comics"
		}

		var newID int
		err = tx.QueryRow(`
			INSERT INTO book (
				title, series_id, editor_id, collection_id,
				volume, isbn, page_count, price, description,
				cover_url, release_date, type, parent_book_id,
				created_at, updated_at
			) VALUES (
				$1, $2, $3, $4,
				$5, $6, $7, $8, $9,
				$10, $11, $12, $13,
				NOW(), NOW()
			) RETURNING id;
		`,
			cleanTitle,
			nil,
			nullableIntPtr(editorID),
			nullableIntPtr(collectionID),
			volVal,
			nullableString(cleanISBN),
			book.PageCount,
			book.Price,
			nullableString(cleanDesc),
			nullableString(storedCover),
			relDate,
			bType,
			nullableIntPtr(parentBookID),
		).Scan(&newID)
		if err != nil {
			log.Printf("Error inserting book '%s': %v", cleanTitle, err)
			return nil
		}
		bookID = &newID
	}

	// 6. Save Authors
	authorTypeMap := map[string]int{
		"writer":      1,
		"scénariste":  1,
		"illustrator": 2,
		"dessinateur": 2,
		"colorist":    3,
		"coloriste":   3,
	}
	for _, authorData := range book.Authors {
		cleanFn := scrapers.CleanText(authorData.Firstname)
		cleanLn := scrapers.CleanText(authorData.Lastname)
		if cleanLn == "" {
			continue
		}

		var authorID int
		if err := tx.QueryRow("SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2);", cleanFn, cleanLn).Scan(&authorID); err != nil {
			if err := tx.QueryRow("INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id;", cleanFn, cleanLn).Scan(&authorID); err != nil {
				continue
			}
		}

		authorTypeID, ok := authorTypeMap[strings.ToLower(authorData.Role)]
		if !ok {
			authorTypeID = 1
		}

		var one int
		if err := tx.QueryRow("SELECT 1 FROM book_has_author WHERE book_id = $1 AND author_id = $2 AND author_type_id = $3;", *bookID, authorID, authorTypeID).Scan(&one); err != nil {
			_, _ = tx.Exec("INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW());", *bookID, authorID, authorTypeID)
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing book '%s': %v", cleanTitle, err)
		return nil
	}
	tx = nil
	return bookID
}

func (d *Database) DetectVolumeConflicts() []map[string]any {
	sqlDB, err := d.getDB()
	if err != nil {
		log.Printf("Error detecting volume conflicts: %v", err)
		return []map[string]any{}
	}

	rows, err := sqlDB.Query(`
		SELECT b.series_id, s.name as series_name, b.volume, COUNT(*)
		FROM book b
		JOIN series s ON b.series_id = s.id
		WHERE b.volume IS NOT NULL AND b.parent_book_id IS NULL
		GROUP BY b.series_id, s.name, b.volume
		HAVING COUNT(*) > 1
		ORDER BY s.name, b.volume;
	`)
	if err != nil {
		log.Printf("Error detecting volume conflicts: %v", err)
		return []map[string]any{}
	}
	type conflictRow struct {
		sid   int
		sname string
		vol   int
		count int
	}
	var conflicts []conflictRow
	for rows.Next() {
		var c conflictRow
		if rows.Scan(&c.sid, &c.sname, &c.vol, &c.count) == nil {
			conflicts = append(conflicts, c)
		}
	}
	rows.Close()

	result := make([]map[string]any, 0)
	seenSeries := make(map[int]bool)

	for _, c := range conflicts {
		if seenSeries[c.sid] {
			continue
		}
		seenSeries[c.sid] = true

		bRows, bErr := sqlDB.Query(`
			SELECT b.id, COALESCE(b.title, ''), b.volume, b.isbn, b.price, b.page_count,
			       b.release_date, b.cover_url, col.name as collection_name,
			       b.parent_book_id
			FROM book b
			LEFT JOIN collection col ON b.collection_id = col.id
			WHERE b.series_id = $1 AND b.parent_book_id IS NULL
			ORDER BY b.volume, b.release_date, b.id;
		`, c.sid)
		if bErr != nil {
			continue
		}

		books := make([]map[string]any, 0)
		for bRows.Next() {
			var (
				id                              int
				title                           string
				vol, price, pageCount, parentID sql.NullInt64
				isbn, coverURL, colName         sql.NullString
				relDate                         sql.NullTime
			)
			if bRows.Scan(&id, &title, &vol, &isbn, &price, &pageCount, &relDate, &coverURL, &colName, &parentID) == nil {
				var relStr any
				if relDate.Valid {
					relStr = relDate.Time.Format("2006-01-02")
				}
				var volVal, isbnVal, priceVal, pagesVal, coverVal, colVal any
				if vol.Valid {
					volVal = int(vol.Int64)
				}
				if isbn.Valid {
					isbnVal = isbn.String
				}
				if price.Valid {
					priceVal = int(price.Int64)
				}
				if pageCount.Valid {
					pagesVal = int(pageCount.Int64)
				}
				if coverURL.Valid {
					coverVal = coverURL.String
				}
				if colName.Valid {
					colVal = colName.String
				}
				books = append(books, map[string]any{
					"id":              id,
					"title":           title,
					"volume":          volVal,
					"isbn":            isbnVal,
					"price":           priceVal,
					"page_count":      pagesVal,
					"release_date":    relStr,
					"cover_url":       coverVal,
					"collection_name": colVal,
					"is_variant_hint": scrapers.IsVariantTitle(title),
				})
			}
		}
		bRows.Close()

		result = append(result, map[string]any{
			"series_id":          c.sid,
			"series_name":        c.sname,
			"conflicting_volume": c.vol,
			"books":              books,
		})
	}
	return result
}

func (d *Database) LinkAsVariant(parentBookID int, variantBookIDs []int) (map[string]any, error) {
	if parentBookID <= 0 || len(variantBookIDs) == 0 {
		return nil, errors.New("parent_book_id and variant_book_ids are required")
	}
	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}

	res, err := sqlDB.Exec(`
		UPDATE book
		SET parent_book_id = $1, updated_at = NOW()
		WHERE id = ANY($2) AND id != $1;
	`, parentBookID, pq.Array(variantBookIDs))
	if err != nil {
		return nil, err
	}
	count, _ := res.RowsAffected()
	log.Printf("Linked %d books as variant of book %d", count, parentBookID)
	return map[string]any{
		"status":           "success",
		"linked_count":     int(count),
		"parent_book_id":   parentBookID,
		"variant_book_ids": variantBookIDs,
	}, nil
}

func (d *Database) ReconcileVariants() (map[string]any, error) {
	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	// 1. Break self-referencing and dangling parent links
	res1, err := tx.Exec(`
		UPDATE book
		SET parent_book_id = NULL, updated_at = NOW()
		WHERE parent_book_id = id;
	`)
	if err != nil {
		return nil, err
	}
	selfRefFixed, _ := res1.RowsAffected()

	res2, err := tx.Exec(`
		UPDATE book
		SET parent_book_id = NULL, updated_at = NOW()
		WHERE parent_book_id IS NOT NULL
		  AND parent_book_id NOT IN (SELECT id FROM book);
	`)
	if err != nil {
		return nil, err
	}
	danglingFixed, _ := res2.RowsAffected()

	seriesReassigned := 0

	// 3. Clean up double 'Edition collector' repetitions
	_, _ = tx.Exec(`
		UPDATE book
		SET title = regexp_replace(title, '(\s*-\s*Edition collector)+', ' - Edition collector', 'gi')
		WHERE title ILIKE '%Edition collector%Edition collector%';
	`)

	// 4. Append ' - Edition collector' if cover is variant but title lacked suffix
	vRows, err := tx.Query(`
		SELECT id, COALESCE(title, ''), COALESCE(cover_url, '') FROM book
		WHERE cover_url ~* '[a-z0-9]+v_\d+\.(?:jpg|jpeg|png|webp)'
		  AND NOT (title ~* '\b(?:couverture\s+variante|variant(?:e)?|collector)\b');
	`)
	if err == nil {
		type vBook struct {
			id    int
			title string
		}
		var vBooks []vBook
		for vRows.Next() {
			var id int
			var title, cov string
			if vRows.Scan(&id, &title, &cov) == nil {
				vBooks = append(vBooks, vBook{id: id, title: title})
			}
		}
		vRows.Close()
		for _, vb := range vBooks {
			newTitle := scrapers.CleanText(vb.title) + " - Edition collector"
			_, _ = tx.Exec("UPDATE book SET title = $1, updated_at = NOW() WHERE id = $2;", newTitle, vb.id)
		}
	}

	// 5. Group books by editor and base title to match and link variants
	allRows, err := tx.Query(`
		SELECT b.id, COALESCE(b.title, ''), b.volume, b.editor_id, b.parent_book_id, COALESCE(b.cover_url, ''), b.price
		FROM book b
		WHERE b.editor_id IS NOT NULL
		ORDER BY b.editor_id, b.volume NULLS LAST, b.id ASC;
	`)
	if err != nil {
		return nil, err
	}

	type groupKey struct {
		editorID int
		baseKey  string
	}
	type bookEntry struct {
		id           int
		title        string
		editorID     int
		parentBookID *int
		coverURL     string
		isVariant    bool
	}

	groupMap := make(map[groupKey][]*bookEntry)
	var groupKeys []groupKey

	for allRows.Next() {
		var (
			id, editorID            int
			title, coverURL         string
			vol, parentID, priceVal sql.NullInt64
		)
		if allRows.Scan(&id, &title, &vol, &editorID, &parentID, &coverURL, &priceVal) == nil {
			var pPtr *int
			if parentID.Valid {
				pVal := int(parentID.Int64)
				pPtr = &pVal
			}
			bKey := strings.ToLower(scrapers.StripVariantSuffix(title))
			gk := groupKey{editorID: editorID, baseKey: bKey}
			if _, exists := groupMap[gk]; !exists {
				groupKeys = append(groupKeys, gk)
			}
			groupMap[gk] = append(groupMap[gk], &bookEntry{
				id:           id,
				title:        title,
				editorID:     editorID,
				parentBookID: pPtr,
				coverURL:     coverURL,
				isVariant:    scrapers.IsVariantBook(title, coverURL, ""),
			})
		}
	}
	allRows.Close()

	variantsLinked := 0
	for _, gk := range groupKeys {
		booksInGroup := groupMap[gk]
		if len(booksInGroup) < 2 {
			continue
		}
		var standards, variants []*bookEntry
		for _, b := range booksInGroup {
			if b.isVariant {
				variants = append(variants, b)
			} else {
				standards = append(standards, b)
			}
		}
		if len(standards) > 0 && len(variants) > 0 {
			parentID := standards[0].id
			for _, v := range variants {
				if v.id != parentID && (v.parentBookID == nil || *v.parentBookID != parentID) {
					if r, err := tx.Exec("UPDATE book SET parent_book_id = $1, updated_at = NOW() WHERE id = $2;", parentID, v.id); err == nil {
						c, _ := r.RowsAffected()
						variantsLinked += int(c)
						pCopy := parentID
						v.parentBookID = &pCopy
					}
				}
			}
			if standards[0].parentBookID != nil {
				_, _ = tx.Exec("UPDATE book SET parent_book_id = NULL, updated_at = NOW() WHERE id = $1;", parentID)
				standards[0].parentBookID = nil
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil

	log.Printf(
		"Reconciled variants: self_ref_fixed=%d, dangling_fixed=%d, series_reassigned=%d, variants_linked=%d",
		selfRefFixed, danglingFixed, seriesReassigned, variantsLinked,
	)

	return map[string]any{
		"status":            "success",
		"self_ref_fixed":    int(selfRefFixed),
		"dangling_fixed":    int(danglingFixed),
		"series_reassigned": seriesReassigned,
		"variants_linked":   variantsLinked,
	}, nil
}

func (d *Database) EnrichBooksFromBnf(limit int) (map[string]any, error) {
	if limit <= 0 {
		limit = 100
	}
	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	rows, err := tx.Query(`
		SELECT b.id, COALESCE(b.title, ''), COALESCE(s.name, '') as series_name, b.volume,
		       COALESCE(e.name, '') as editor_name, b.page_count, b.collection_id, COALESCE(b.cover_url, '')
		FROM book b
		LEFT JOIN series s ON b.series_id = s.id
		LEFT JOIN editor e ON b.editor_id = e.id
		WHERE b.isbn IS NULL OR b.isbn = '' OR LENGTH(TRIM(b.isbn)) < 10
		ORDER BY b.id DESC
		LIMIT $1;
	`, limit)
	if err != nil {
		return nil, err
	}

	type candBook struct {
		id           int
		title        string
		seriesName   string
		volume       *int
		editorName   string
		pageCount    *int
		collectionID *int
		coverURL     string
	}
	var books []candBook
	for rows.Next() {
		var (
			b                  candBook
			vol, pCount, colID sql.NullInt64
		)
		if rows.Scan(&b.id, &b.title, &b.seriesName, &vol, &b.editorName, &pCount, &colID, &b.coverURL) == nil {
			if vol.Valid {
				v := int(vol.Int64)
				b.volume = &v
			}
			if pCount.Valid {
				p := int(pCount.Int64)
				b.pageCount = &p
			}
			if colID.Valid {
				c := int(colID.Int64)
				b.collectionID = &c
			}
			books = append(books, b)
		}
	}
	rows.Close()

	scannedCount := len(books)
	enrichedCount := 0
	enrichedDetails := make([]map[string]any, 0)

	for _, b := range books {
		isVar := scrapers.IsVariantBook(b.title, b.coverURL, "")
		bnfData := SearchBnfBook(b.title, b.seriesName, b.editorName, b.volume, isVar, 8)
		if bnfData == nil || bnfData.ISBN == "" {
			continue
		}

		foundISBN := bnfData.ISBN
		foundPages := 0
		if bnfData.PageCount != nil {
			foundPages = *bnfData.PageCount
		}
		foundCol := bnfData.CollectionName
		foundAuthors := bnfData.Authors

		_, _ = tx.Exec("SAVEPOINT bnf_book_sp;")
		errSP := func() error {
			newColID := b.collectionID
			if newColID == nil && foundCol != "" {
				cleanCol := scrapers.CleanText(foundCol)
				var cid int
				if err := tx.QueryRow("SELECT id FROM collection WHERE LOWER(name) = LOWER($1);", cleanCol).Scan(&cid); err == nil {
					newColID = &cid
				} else if err := tx.QueryRow("INSERT INTO collection (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id;", cleanCol).Scan(&cid); err == nil {
					newColID = &cid
				}
			}

			isbnToSet := foundISBN
			var holderID int
			if err := tx.QueryRow("SELECT id FROM book WHERE isbn = $1 AND id != $2;", foundISBN, b.id).Scan(&holderID); err == nil {
				log.Printf("BNF ISBN %s for book %d ('%s') already held by book %d. Skipping ISBN assignment.", foundISBN, b.id, b.title, holderID)
				isbnToSet = ""
			}

			if isbnToSet != "" {
				if _, err := tx.Exec(`
					UPDATE book
					SET isbn = $1,
					    page_count = CASE WHEN page_count IS NULL OR page_count = 0 THEN $2 ELSE page_count END,
					    collection_id = COALESCE($3, collection_id),
					    updated_at = NOW()
					WHERE id = $4;
				`, isbnToSet, foundPages, nullableIntPtr(newColID), b.id); err != nil {
					return err
				}
			} else {
				if _, err := tx.Exec(`
					UPDATE book
					SET page_count = CASE WHEN page_count IS NULL OR page_count = 0 THEN $1 ELSE page_count END,
					    collection_id = COALESCE($2, collection_id),
					    updated_at = NOW()
					WHERE id = $3;
				`, foundPages, nullableIntPtr(newColID), b.id); err != nil {
					return err
				}
			}

			var hasAuth int
			if err := tx.QueryRow("SELECT 1 FROM book_has_author WHERE book_id = $1 LIMIT 1;", b.id).Scan(&hasAuth); err != nil && len(foundAuthors) > 0 {
				for _, auth := range foundAuthors {
					cleanFn := scrapers.CleanText(auth.Firstname)
					cleanLn := scrapers.CleanText(auth.Lastname)
					if cleanLn == "" {
						continue
					}
					var aID int
					if err := tx.QueryRow("SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2);", cleanFn, cleanLn).Scan(&aID); err != nil {
						if err := tx.QueryRow("INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id;", cleanFn, cleanLn).Scan(&aID); err != nil {
							continue
						}
					}
					typeID := 3
					if auth.Role == "Writer" {
						typeID = 1
					} else if auth.Role == "Illustrator" {
						typeID = 2
					}
					_, _ = tx.Exec("INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW());", b.id, aID, typeID)
				}
			}

			var pageCountOut any
			if bnfData.PageCount != nil {
				pageCountOut = *bnfData.PageCount
			}
			var colOut any
			if foundCol != "" {
				colOut = foundCol
			}
			isbnOut := foundISBN
			if isbnToSet != "" {
				isbnOut = isbnToSet
			}

			enrichedCount++
			enrichedDetails = append(enrichedDetails, map[string]any{
				"book_id":       b.id,
				"title":         b.title,
				"isbn":          isbnOut,
				"isbn_assigned": isbnToSet != "",
				"page_count":    pageCountOut,
				"collection":    colOut,
			})
			return nil
		}()

		if errSP != nil {
			_, _ = tx.Exec("ROLLBACK TO SAVEPOINT bnf_book_sp;")
			log.Printf("Failed to enrich book %d with BNF data: %v", b.id, errSP)
		} else {
			_, _ = tx.Exec("RELEASE SAVEPOINT bnf_book_sp;")
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil

	log.Printf("BNF enrichment completed: scanned=%d, enriched=%d", scannedCount, enrichedCount)
	return map[string]any{
		"status":   "success",
		"scanned":  scannedCount,
		"enriched": enrichedCount,
		"details":  enrichedDetails,
	}, nil
}

func (d *Database) SplitSeries(sourceSeriesID int, newSeriesName string, bookIDs []int) (map[string]any, error) {
	if strings.TrimSpace(newSeriesName) == "" || len(bookIDs) == 0 {
		return nil, errors.New("new_series_name and book_ids are required")
	}
	cleanNewName := scrapers.CleanText(newSeriesName)

	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	var categoryID sql.NullInt64
	var status sql.NullString
	if err := tx.QueryRow("SELECT category_id, status FROM series WHERE id = $1;", sourceSeriesID).Scan(&categoryID, &status); err != nil {
		return nil, fmt.Errorf("Series with id %d not found", sourceSeriesID)
	}

	var newSeriesID int
	if err := tx.QueryRow("SELECT id FROM series WHERE LOWER(name) = LOWER($1);", cleanNewName).Scan(&newSeriesID); err != nil {
		if err := tx.QueryRow(`
			INSERT INTO series (name, status, category_id, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			RETURNING id;
		`, cleanNewName, status, categoryID).Scan(&newSeriesID); err != nil {
			return nil, err
		}
	}

	res, err := tx.Exec(`
		UPDATE book
		SET series_id = $1, updated_at = NOW()
		WHERE id = ANY($2) AND series_id = $3;
	`, newSeriesID, pq.Array(bookIDs), sourceSeriesID)
	if err != nil {
		return nil, err
	}
	movedCount, _ := res.RowsAffected()

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil

	log.Printf("Split series %d -> %d (%s): moved %d books", sourceSeriesID, newSeriesID, cleanNewName, movedCount)
	return map[string]any{
		"status":           "success",
		"moved_count":      int(movedCount),
		"source_series_id": sourceSeriesID,
		"new_series_id":    newSeriesID,
		"new_series_name":  cleanNewName,
	}, nil
}

func (d *Database) VerifyBooksFromBnf(limit int, forceUpdatePages bool) (map[string]any, error) {
	if limit <= 0 {
		limit = 100
	}
	sqlDB, err := d.getDB()
	if err != nil {
		return nil, err
	}
	tx, err := sqlDB.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	rows, err := tx.Query(`
		SELECT b.id, COALESCE(b.title, ''), COALESCE(b.isbn, ''), b.page_count, b.collection_id, b.release_date
		FROM book b
		WHERE b.isbn IS NOT NULL AND LENGTH(TRIM(b.isbn)) >= 10
		ORDER BY (CASE WHEN b.page_count IS NULL OR b.page_count = 0 THEN 0 ELSE 1 END), b.updated_at ASC
		LIMIT $1;
	`, limit)
	if err != nil {
		return nil, err
	}

	type verifyRow struct {
		id           int
		title        string
		isbn         string
		pageCount    *int
		collectionID *int
		releaseDate  *time.Time
	}
	var books []verifyRow
	for rows.Next() {
		var (
			b           verifyRow
			pCount, cID sql.NullInt64
			rDate       sql.NullTime
		)
		if rows.Scan(&b.id, &b.title, &b.isbn, &pCount, &cID, &rDate) == nil {
			if pCount.Valid {
				p := int(pCount.Int64)
				b.pageCount = &p
			}
			if cID.Valid {
				c := int(cID.Int64)
				b.collectionID = &c
			}
			if rDate.Valid {
				t := rDate.Time
				b.releaseDate = &t
			}
			books = append(books, b)
		}
	}
	rows.Close()

	scannedCount := len(books)
	verifiedCount := 0
	updatedCount := 0
	pagesCorrected := 0
	collectionsAdded := 0
	authorsAdded := 0
	details := make([]map[string]any, 0)

	for _, b := range books {
		cleanISBN := reBnfNonISBN.ReplaceAllString(b.isbn, "")
		if len(cleanISBN) != 10 && len(cleanISBN) != 13 {
			continue
		}

		bnfMeta := LookupBnfByISBN(cleanISBN, 6)
		if bnfMeta == nil {
			continue
		}

		verifiedCount++
		bnfPages := bnfMeta.PageCount
		bnfCol := bnfMeta.CollectionName
		bnfDate := bnfMeta.ReleaseDate
		bnfAuthors := bnfMeta.Authors

		bookModified := false
		_, _ = tx.Exec("SAVEPOINT verify_isbn_sp;")
		errSP := func() error {
			// 1. Check page_count
			newPages := b.pageCount
			if bnfPages != nil && *bnfPages > 0 {
				if b.pageCount == nil || *b.pageCount == 0 || (forceUpdatePages && *b.pageCount != *bnfPages) {
					pCopy := *bnfPages
					newPages = &pCopy
					bookModified = true
					pagesCorrected++
				}
			}

			// 2. Check collection
			newColID := b.collectionID
			if newColID == nil && bnfCol != "" {
				cleanCol := scrapers.CleanText(bnfCol)
				var cid int
				if err := tx.QueryRow("SELECT id FROM collection WHERE LOWER(name) = LOWER($1);", cleanCol).Scan(&cid); err == nil {
					newColID = &cid
				} else if err := tx.QueryRow("INSERT INTO collection (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id;", cleanCol).Scan(&cid); err == nil {
					newColID = &cid
				}
				bookModified = true
				collectionsAdded++
			}

			// 3. Check release_date
			newDate := b.releaseDate
			if newDate == nil && bnfDate != nil {
				newDate = bnfDate
				bookModified = true
			}

			if bookModified {
				pVal := 0
				if newPages != nil {
					pVal = *newPages
				}
				if _, err := tx.Exec(`
					UPDATE book
					SET page_count = $1,
					    collection_id = $2,
					    release_date = COALESCE(release_date, $3),
					    updated_at = NOW()
					WHERE id = $4;
				`, pVal, nullableIntPtr(newColID), newDate, b.id); err != nil {
					return err
				}
			} else {
				_, _ = tx.Exec("UPDATE book SET updated_at = NOW() WHERE id = $1;", b.id)
			}

			// 4. Check authors
			authAddedCount := 0
			var hasAuth int
			if err := tx.QueryRow("SELECT 1 FROM book_has_author WHERE book_id = $1 LIMIT 1;", b.id).Scan(&hasAuth); err != nil && len(bnfAuthors) > 0 {
				for _, auth := range bnfAuthors {
					cleanFn := scrapers.CleanText(auth.Firstname)
					cleanLn := scrapers.CleanText(auth.Lastname)
					if cleanLn == "" {
						continue
					}
					var aID int
					if err := tx.QueryRow("SELECT id FROM author WHERE LOWER(firstname) = LOWER($1) AND LOWER(lastname) = LOWER($2);", cleanFn, cleanLn).Scan(&aID); err != nil {
						if err := tx.QueryRow("INSERT INTO author (firstname, lastname, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id;", cleanFn, cleanLn).Scan(&aID); err != nil {
							continue
						}
					}
					typeID := 3
					if auth.Role == "Writer" {
						typeID = 1
					} else if auth.Role == "Illustrator" {
						typeID = 2
					}
					if _, err := tx.Exec("INSERT INTO book_has_author (book_id, author_id, author_type_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW());", b.id, aID, typeID); err == nil {
						authAddedCount++
					}
				}
				if authAddedCount > 0 {
					bookModified = true
					authorsAdded += authAddedCount
				}
			}

			if bookModified {
				updatedCount++
				var oldPagesVal, newPagesVal, colOut any
				if b.pageCount != nil {
					oldPagesVal = *b.pageCount
				}
				if newPages != nil {
					newPagesVal = *newPages
				}
				if b.collectionID == nil && newColID != nil && bnfCol != "" {
					colOut = bnfCol
				}
				details = append(details, map[string]any{
					"book_id":       b.id,
					"title":         b.title,
					"isbn":          cleanISBN,
					"old_pages":     oldPagesVal,
					"new_pages":     newPagesVal,
					"collection":    colOut,
					"authors_added": authAddedCount,
				})
			}
			return nil
		}()

		if errSP != nil {
			_, _ = tx.Exec("ROLLBACK TO SAVEPOINT verify_isbn_sp;")
			log.Printf("Failed to verify/update book %d (ISBN %s): %v", b.id, cleanISBN, errSP)
		} else {
			_, _ = tx.Exec("RELEASE SAVEPOINT verify_isbn_sp;")
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	tx = nil

	log.Printf(
		"BNF ISBN verification completed: scanned=%d, verified_in_bnf=%d, updated=%d (pages_corrected=%d, collections_added=%d, authors_added=%d)",
		scannedCount, verifiedCount, updatedCount, pagesCorrected, collectionsAdded, authorsAdded,
	)

	return map[string]any{
		"status":            "success",
		"scanned":           scannedCount,
		"verified_in_bnf":   verifiedCount,
		"updated_count":     updatedCount,
		"pages_corrected":   pagesCorrected,
		"collections_added": collectionsAdded,
		"authors_added":     authorsAdded,
		"details":           details,
	}, nil
}

func (d *Database) GetRecentBooks(limit int) []map[string]any {
	if limit <= 0 {
		limit = 20
	}
	sqlDB, err := d.getDB()
	if err != nil {
		log.Printf("Error fetching recent books: %v", err)
		return []map[string]any{}
	}

	rows, err := sqlDB.Query(`
		SELECT b.id, COALESCE(b.title, ''), b.isbn, b.volume, b.release_date, b.cover_url,
		       e.name as editor_name, s.name as series_name, b.price
		FROM book b
		LEFT JOIN editor e ON b.editor_id = e.id
		LEFT JOIN series s ON b.series_id = s.id
		ORDER BY b.created_at DESC
		LIMIT $1;
	`, limit)
	if err != nil {
		log.Printf("Error fetching recent books: %v", err)
		return []map[string]any{}
	}
	defer rows.Close()

	result := make([]map[string]any, 0)
	for rows.Next() {
		var (
			id                            int
			title                         string
			isbn, coverURL, edName, sName sql.NullString
			vol, price                    sql.NullInt64
			relDate                       sql.NullTime
		)
		if rows.Scan(&id, &title, &isbn, &vol, &relDate, &coverURL, &edName, &sName, &price) == nil {
			var isbnVal, volVal, relVal, covVal, edVal, sVal, priceVal any
			if isbn.Valid {
				isbnVal = isbn.String
			}
			if vol.Valid {
				volVal = int(vol.Int64)
			}
			if relDate.Valid {
				relVal = relDate.Time.Format(time.RFC3339)
			}
			if coverURL.Valid {
				covVal = coverURL.String
			}
			if edName.Valid {
				edVal = edName.String
			}
			if sName.Valid {
				sVal = sName.String
			}
			if price.Valid {
				priceVal = int(price.Int64)
			}
			result = append(result, map[string]any{
				"id":           id,
				"title":        title,
				"isbn":         isbnVal,
				"volume":       volVal,
				"release_date": relVal,
				"cover_url":    covVal,
				"editor_name":  edVal,
				"series_name":  sVal,
				"price":        priceVal,
			})
		}
	}
	return result
}
