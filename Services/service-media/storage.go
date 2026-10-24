package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound = errors.New("image not found")
	ErrNotReady = errors.New("image is not ready")
)

type ImageMetadata struct {
	ID           string    `json:"id"`
	Status       string    `json:"status"` // "pending", "ready", "failed"
	Width        int       `json:"width,omitempty"`
	Height       int       `json:"height,omitempty"`
	Size         int64     `json:"size,omitempty"` // taille / poids en octets
	Format       string    `json:"format,omitempty"`
	MimeType     string    `json:"mime_type,omitempty"`
	OriginalName string    `json:"original_name,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Storage struct {
	baseDir string
	db      *Database
	mu      sync.RWMutex
}

func NewStorage(baseDir string, db *Database) (*Storage, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base media directory: %w", err)
	}
	return &Storage{baseDir: baseDir, db: db}, nil
}

func (s *Storage) imageDir(id string) string {
	return filepath.Join(s.baseDir, id)
}

func (s *Storage) metaPath(id string) string {
	return filepath.Join(s.imageDir(id), "meta.json")
}

func (s *Storage) masterImagePath(id string) string {
	return filepath.Join(s.imageDir(id), "original.webp")
}

// CreateSlot creates a virtual image slot and returns metadata with a generated UUID
func (s *Storage) CreateSlot() (*ImageMetadata, error) {
	id := uuid.New().String()
	now := time.Now().UTC()

	meta := &ImageMetadata{
		ID:        id,
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}

	dir := s.imageDir(id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create image folder: %w", err)
	}

	if s.db != nil {
		if err := s.db.InsertSlot(id, now); err != nil {
			log.Printf("[Storage] DB insert slot failed for %s: %v", id, err)
		}
	}

	if err := s.SaveMetadata(meta); err != nil {
		return nil, err
	}

	return meta, nil
}

// GetMetadata retrieves the metadata for a given image id
func (s *Storage) GetMetadata(id string) (*ImageMetadata, error) {
	if s.db != nil {
		if meta, err := s.db.GetImage(id); err == nil {
			return meta, nil
		} else if errors.Is(err, ErrNotFound) {
			return nil, ErrNotFound
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	path := s.metaPath(id)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	var meta ImageMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	return &meta, nil
}

// SaveMetadata writes metadata to disk
func (s *Storage) SaveMetadata(meta *ImageMetadata) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	meta.UpdatedAt = time.Now().UTC()
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	path := s.metaPath(meta.ID)
	return os.WriteFile(path, data, 0644)
}

// SaveMasterImage writes the master optimized WebP image and updates metadata
func (s *Storage) SaveMasterImage(id string, data []byte, width, height int, originalName string) (*ImageMetadata, error) {
	dir := s.imageDir(id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	// Remove any cached variants since master image changed
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		if entry.Name() != "meta.json" {
			_ = os.Remove(filepath.Join(dir, entry.Name()))
		}
	}

	masterPath := s.masterImagePath(id)
	if err := os.WriteFile(masterPath, data, 0644); err != nil {
		return nil, fmt.Errorf("failed to write master image: %w", err)
	}

	meta, err := s.GetMetadata(id)
	if err != nil {
		meta = &ImageMetadata{
			ID:        id,
			CreatedAt: time.Now().UTC(),
		}
	}

	meta.Status = "ready"
	meta.Width = width
	meta.Height = height
	meta.Size = int64(len(data))
	meta.Format = "webp"
	meta.MimeType = "image/webp"
	if originalName != "" {
		meta.OriginalName = originalName
	}

	if s.db != nil {
		if err := s.db.UpdateImageReady(id, width, height, meta.Size, meta.Format, meta.MimeType, meta.OriginalName); err != nil {
			log.Printf("[Storage] DB update ready failed for %s: %v", id, err)
		}
	}

	if err := s.SaveMetadata(meta); err != nil {
		return nil, err
	}

	return meta, nil
}

// GetMasterImagePath returns path if ready
func (s *Storage) GetMasterImagePath(id string) (string, error) {
	masterPath := s.masterImagePath(id)
	if _, err := os.Stat(masterPath); err == nil {
		return masterPath, nil
	}

	// Check if slot exists but is not ready yet
	meta, err := s.GetMetadata(id)
	if err != nil {
		return "", err
	}
	if meta.Status != "ready" {
		return "", ErrNotReady
	}
	return "", ErrNotFound
}

// VariantImagePath returns path for a resized variant
func (s *Storage) VariantImagePath(id string, w, h int) string {
	return filepath.Join(s.imageDir(id), fmt.Sprintf("variant_w%d_h%d.webp", w, h))
}

// SaveVariantImage writes a resized variant to disk
func (s *Storage) SaveVariantImage(id string, w, h int, data []byte) error {
	path := s.VariantImagePath(id, w, h)
	return os.WriteFile(path, data, 0644)
}

// DeleteImage deletes image directory and DB entry
func (s *Storage) DeleteImage(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil {
		if err := s.db.DeleteImage(id); err != nil {
			log.Printf("[Storage] DB delete failed for %s: %v", id, err)
		}
	}

	dir := s.imageDir(id)
	return os.RemoveAll(dir)
}
