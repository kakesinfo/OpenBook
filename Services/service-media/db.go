package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/lib/pq"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(dbURL string, dataDir string) (*Database, error) {
	if dbURL == "" {
		return nil, errors.New("DATABASE_URL is empty")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	schema := `
	CREATE SCHEMA IF NOT EXISTS media;

	CREATE TABLE IF NOT EXISTS media.images (
		id UUID PRIMARY KEY,
		status VARCHAR(32) NOT NULL,
		width INT,
		height INT,
		size BIGINT,
		format VARCHAR(32),
		mime_type VARCHAR(64),
		original_name TEXT,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_media_images_status ON media.images(status);
	CREATE INDEX IF NOT EXISTS idx_media_images_created_at ON media.images(created_at);
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to initialize media schema: %w", err)
	}

	d := &Database{db: db}

	// Backfill existing files on disk into media.images if schema is empty
	d.backfillFromDisk(dataDir)

	return d, nil
}

func (d *Database) backfillFromDisk(dataDir string) {
	var count int
	_ = d.db.QueryRow("SELECT COUNT(*) FROM media.images;").Scan(&count)
	if count > 0 {
		log.Printf("[Database] Connected. Total records in 'media.images': %d", count)
		return
	}

	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return
	}

	log.Printf("[Database] Initializing empty schema from existing media files in %s...", dataDir)
	imported := 0

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		id := entry.Name()
		metaFile := filepath.Join(dataDir, id, "meta.json")
		data, err := os.ReadFile(metaFile)
		if err != nil {
			continue
		}

		var m ImageMetadata
		if err := json.Unmarshal(data, &m); err != nil || m.ID == "" {
			continue
		}

		createdAt := m.CreatedAt
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}
		updatedAt := m.UpdatedAt
		if updatedAt.IsZero() {
			updatedAt = createdAt
		}

		_, err = d.db.Exec(`
			INSERT INTO media.images (id, status, width, height, size, format, mime_type, original_name, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (id) DO NOTHING;
		`, m.ID, m.Status, m.Width, m.Height, m.Size, m.Format, m.MimeType, m.OriginalName, createdAt, updatedAt)
		if err == nil {
			imported++
		}
	}

	if imported > 0 {
		log.Printf("[Database] Successfully imported %d media records from disk into 'media.images' table", imported)
	}
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) InsertSlot(id string, createdAt time.Time) error {
	_, err := d.db.Exec(`
		INSERT INTO media.images (id, status, created_at, updated_at)
		VALUES ($1, 'pending', $2, $2)
		ON CONFLICT (id) DO NOTHING;
	`, id, createdAt)
	return err
}

func (d *Database) GetImage(id string) (*ImageMetadata, error) {
	row := d.db.QueryRow(`
		SELECT id, status, COALESCE(width, 0), COALESCE(height, 0), COALESCE(size, 0),
		       COALESCE(format, ''), COALESCE(mime_type, ''), COALESCE(original_name, ''),
		       created_at, updated_at
		FROM media.images
		WHERE id = $1;
	`, id)

	var m ImageMetadata
	var idStr string
	if err := row.Scan(&idStr, &m.Status, &m.Width, &m.Height, &m.Size, &m.Format, &m.MimeType, &m.OriginalName, &m.CreatedAt, &m.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	m.ID = idStr
	return &m, nil
}

func (d *Database) UpdateImageReady(id string, width, height int, size int64, format, mimeType, originalName string) error {
	_, err := d.db.Exec(`
		UPDATE media.images
		SET status = 'ready',
		    width = $2,
		    height = $3,
		    size = $4,
		    format = $5,
		    mime_type = $6,
		    original_name = $7,
		    updated_at = NOW()
		WHERE id = $1;
	`, id, width, height, size, format, mimeType, originalName)
	return err
}

func (d *Database) DeleteImage(id string) error {
	_, err := d.db.Exec(`DELETE FROM media.images WHERE id = $1;`, id)
	return err
}
