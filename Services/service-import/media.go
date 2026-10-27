package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type MediaClient struct {
	baseURL    string
	httpClient *http.Client
	cacheMu    sync.RWMutex
	cache      map[string]string // source (url or local path) -> media UUID
}

func NewMediaClient(baseURL string) *MediaClient {
	return &MediaClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 35 * time.Second},
		cache:      make(map[string]string),
	}
}

// UploadFromZip uploads a local image file located inside the .bookmory zip archive to service-media.
func (m *MediaClient) UploadFromZip(zf *zip.File) (string, error) {
	if zf == nil {
		return "", fmt.Errorf("nil zip file")
	}

	cacheKey := "zip:" + zf.Name
	m.cacheMu.RLock()
	if id, ok := m.cache[cacheKey]; ok && id != "" {
		m.cacheMu.RUnlock()
		return id, nil
	}
	m.cacheMu.RUnlock()

	rc, err := zf.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open zip file %s: %w", zf.Name, err)
	}
	defer rc.Close()

	imgData, err := io.ReadAll(rc)
	if err != nil {
		return "", fmt.Errorf("failed to read zip file %s: %w", zf.Name, err)
	}

	slotID, err := m.createImageSlot()
	if err != nil {
		return "", err
	}

	// Upload raw image bytes to slot
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/images/%s", m.baseURL, slotID), bytes.NewReader(imgData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "image/jpeg")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload image bytes for %s: %w", zf.Name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("media service upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	m.cacheMu.Lock()
	m.cache[cacheKey] = slotID
	m.cacheMu.Unlock()

	return slotID, nil
}

// UploadRemoteURL uploads an image from an external HTTP(S) URL to service-media.
func (m *MediaClient) UploadRemoteURL(remoteURL string) (string, error) {
	cleanURL := strings.TrimSpace(remoteURL)
	if cleanURL == "" {
		return "", fmt.Errorf("empty image URL")
	}
	if !strings.HasPrefix(cleanURL, "http://") && !strings.HasPrefix(cleanURL, "https://") {
		return cleanURL, nil
	}

	cacheKey := "url:" + cleanURL
	m.cacheMu.RLock()
	if id, ok := m.cache[cacheKey]; ok && id != "" {
		m.cacheMu.RUnlock()
		return id, nil
	}
	m.cacheMu.RUnlock()

	slotID, err := m.createImageSlot()
	if err != nil {
		return "", err
	}

	payload, _ := json.Marshal(map[string]string{"url": cleanURL})
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/images/%s", m.baseURL, slotID), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to trigger remote image download for %s: %w", cleanURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("remote image upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	m.cacheMu.Lock()
	m.cache[cacheKey] = slotID
	m.cacheMu.Unlock()

	return slotID, nil
}

func (m *MediaClient) createImageSlot() (string, error) {
	resp, err := m.httpClient.Post(fmt.Sprintf("%s/images", m.baseURL), "application/json", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create image slot in service-media: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to create image slot, status %d: %s", resp.StatusCode, string(body))
	}

	var slot struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&slot); err != nil || slot.ID == "" {
		return "", fmt.Errorf("invalid response from service-media slot creation: %w", err)
	}

	return slot.ID, nil
}

// ProcessBookCover resolves cover URL / file: uploads if needed, returns media UUID or fallback.
func (m *MediaClient) ProcessBookCover(imageField string, zipImages map[string]*zip.File) string {
	raw := strings.TrimSpace(imageField)
	if raw == "" {
		return ""
	}

	// 1. Check if it's a local path in the zip
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		// e.g. "bookmory_data/images/books/book_1773311875974.jpg" or "images/books/book_..."
		basename := raw
		if idx := strings.LastIndex(raw, "/"); idx != -1 {
			basename = raw[idx+1:]
		}

		if zf, ok := zipImages[basename]; ok && zf != nil {
			slotID, err := m.UploadFromZip(zf)
			if err == nil && slotID != "" {
				return slotID
			}
			log.Printf("[MediaClient] Failed to upload zip image %s: %v", basename, err)
		}
		return ""
	}

	// 2. Remote URL
	slotID, err := m.UploadRemoteURL(raw)
	if err == nil && slotID != "" {
		return slotID
	}
	log.Printf("[MediaClient] Failed to upload remote image %s: %v (falling back to raw URL)", raw, err)
	return raw
}
