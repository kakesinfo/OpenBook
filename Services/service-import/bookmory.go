package main

import (
	"archive/zip"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func (p *ParsedBookmory) Close() {
	if p.ZipCloser != nil {
		_ = p.ZipCloser.Close()
	}
	if p.TempDir != "" {
		_ = os.RemoveAll(p.TempDir)
	}
}

func stringKey(k any) string {
	switch v := k.(type) {
	case []byte:
		return string(v)
	case string:
		return v
	default:
		return fmt.Sprintf("%v", v)
	}
}

// ParseBookmoryZip parses a .bookmory zip archive file path.
func ParseBookmoryZip(zipPath string) (*ParsedBookmory, error) {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open bookmory zip archive: %w", err)
	}

	tempDir, err := os.MkdirTemp("", "bookmory_import_*")
	if err != nil {
		_ = zr.Close()
		return nil, fmt.Errorf("failed to create temp directory for sqlite: %w", err)
	}

	parsed := &ParsedBookmory{
		Series:       make(map[string]string),
		Publishers:   make(map[string]string),
		Collections:  make(map[string]string),
		Authors:      make(map[string]string),
		Illustrators: make(map[string]string),
		Tags:         make(map[string]string),
		BookTags:     make(map[string][]string),
		ZipImages:    make(map[string]*zip.File),
		TempDir:      tempDir,
		ZipCloser:    zr,
	}

	var dbFile *zip.File
	for _, f := range zr.File {
		cleanName := strings.TrimPrefix(f.Name, "/")
		if cleanName == "new_bookmory.db" || strings.HasSuffix(cleanName, "/new_bookmory.db") {
			dbFile = f
		}
		// Index images by basename
		if strings.HasPrefix(cleanName, "images/books/") || strings.HasPrefix(cleanName, "bookmory_data/images/books/") {
			base := filepath.Base(cleanName)
			parsed.ZipImages[base] = f
		}
	}

	if dbFile == nil {
		parsed.Close()
		return nil, fmt.Errorf("new_bookmory.db not found in archive")
	}

	// Extract new_bookmory.db to temp file
	sqlitePath := filepath.Join(tempDir, "new_bookmory.db")
	rc, err := dbFile.Open()
	if err != nil {
		parsed.Close()
		return nil, fmt.Errorf("failed to open new_bookmory.db in zip: %w", err)
	}
	defer rc.Close()

	out, err := os.Create(sqlitePath)
	if err != nil {
		parsed.Close()
		return nil, fmt.Errorf("failed to create temp sqlite file: %w", err)
	}
	if _, err := io.Copy(out, rc); err != nil {
		_ = out.Close()
		parsed.Close()
		return nil, fmt.Errorf("failed to extract sqlite db: %w", err)
	}
	_ = out.Close()

	// Open SQLite database
	db, err := sql.Open("sqlite", sqlitePath)
	if err != nil {
		parsed.Close()
		return nil, fmt.Errorf("failed to open extracted sqlite db: %w", err)
	}
	defer db.Close()

	// 1. Series
	parsed.Series = readStoreMap(db, "series")
	// 2. Publishers
	parsed.Publishers = readStoreMap(db, "publishers")
	// 3. Collections (kept in memory for reference / tagging)
	parsed.Collections = readStoreMap(db, "collections")
	// 4. Authors
	parsed.Authors = readStoreMap(db, "authors")
	// 5. Illustrators
	parsed.Illustrators = readStoreMap(db, "illustrators")

	// 6. Tags
	tagRows, err := db.Query("SELECT key, value FROM entry WHERE store = 'tags' AND (deleted IS NULL OR deleted = 0);")
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tKey any
			var tVal string
			if err := tagRows.Scan(&tKey, &tVal); err != nil {
				continue
			}
			var tagObj struct {
				Name string   `json:"name"`
				Bids []string `json:"bids"`
			}
			if err := json.Unmarshal([]byte(tVal), &tagObj); err == nil && tagObj.Name != "" {
				tagName := strings.TrimSpace(tagObj.Name)
				parsed.Tags[stringKey(tKey)] = tagName
				for _, bid := range tagObj.Bids {
					parsed.BookTags[bid] = append(parsed.BookTags[bid], tagName)
				}
			}
		}
	}

	// 7. Books
	rows, err := db.Query("SELECT key, value FROM entry WHERE store = 'books' AND (deleted IS NULL OR deleted = 0);")
	if err != nil {
		parsed.Close()
		return nil, fmt.Errorf("failed to query books from sqlite: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var key any
		var valStr string
		if err := rows.Scan(&key, &valStr); err != nil {
			continue
		}
		var b BookmoryBook
		if err := json.Unmarshal([]byte(valStr), &b); err != nil {
			log.Printf("[Bookmory] Failed to unmarshal book %v: %v", key, err)
			continue
		}
		b.Key = stringKey(key)
		parsed.Books = append(parsed.Books, &b)
	}

	log.Printf("[Bookmory] Parsed %d books, %d series, %d publishers, %d collections, %d tags, %d images from archive",
		len(parsed.Books), len(parsed.Series), len(parsed.Publishers), len(parsed.Collections), len(parsed.Tags), len(parsed.ZipImages))

	return parsed, nil
}

func readStoreMap(db *sql.DB, storeName string) map[string]string {
	result := make(map[string]string)
	rows, err := db.Query(fmt.Sprintf("SELECT key, value FROM entry WHERE store = '%s' AND (deleted IS NULL OR deleted = 0);", storeName))
	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var key any
		var valStr string
		if err := rows.Scan(&key, &valStr); err != nil {
			continue
		}
		var obj struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal([]byte(valStr), &obj); err == nil && obj.Name != "" {
			result[stringKey(key)] = strings.TrimSpace(obj.Name)
		}
	}
	return result
}
