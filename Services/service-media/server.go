package main

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	config    *Config
	storage   *Storage
	processor *Processor
}

func NewServer(cfg *Config, storage *Storage, processor *Processor) *Server {
	return &Server{
		config:    cfg,
		storage:   storage,
		processor: processor,
	}
}

// corsMiddleware adds standard CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, If-None-Match")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type, ETag")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "UP",
			"service": "service-media",
		})
	})

	// 1. Create a "virtual image" -> returns UUID
	mux.HandleFunc("POST /images", s.handleCreateImage)

	// 2. Upload an image on this UUID
	mux.HandleFunc("POST /images/{id}", s.handleUploadImage)
	mux.HandleFunc("POST /images/{id}/upload", s.handleUploadImage)

	// 3. Get info on this image (dimensions, weight/size)
	mux.HandleFunc("GET /images/{id}", s.handleGetImageInfo)
	mux.HandleFunc("GET /images/{id}/info", s.handleGetImageInfo)

	// 4. Get binary blob of this image (with size options)
	mux.HandleFunc("GET /images/{id}/blob", s.handleGetImageBlob)
	mux.HandleFunc("HEAD /images/{id}/blob", s.handleGetImageBlob)

	// 5. Delete an image
	mux.HandleFunc("DELETE /images/{id}", s.handleDeleteImage)

	return corsMiddleware(mux)
}

// POST /images: Create a virtual image slot and return UUID
func (s *Server) handleCreateImage(w http.ResponseWriter, r *http.Request) {
	meta, err := s.storage.CreateSlot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("Failed to create image slot: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusCreated, meta)
}

var remoteClient = &http.Client{Timeout: 20 * time.Second}

// fetchRemote downloads a remote resource with browser-like headers
// (some hosts reject requests without a User-Agent / Referer).
func fetchRemote(rawURL string) (*http.Response, error) {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("invalid URL")
	}
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5")
	req.Header.Set("Referer", u.Scheme+"://"+u.Host+"/")
	return remoteClient.Do(req)
}

type RemoteURLUploadPayload struct {
	URL string `json:"url"`
}

// POST /images/{id}: Upload an image to an existing or new UUID
func (s *Server) handleUploadImage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing image ID"})
		return
	}

	contentType := r.Header.Get("Content-Type")
	var imageReader io.Reader
	var originalFilename string

	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Multipart file upload
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Failed to parse multipart form"})
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			// Try "image" field
			file, header, err = r.FormFile("image")
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No file uploaded under 'file' or 'image' field"})
			return
		}
		defer file.Close()
		imageReader = file
		originalFilename = header.Filename
	} else if strings.HasPrefix(contentType, "application/json") {
		// Download from remote URL
		var payload RemoteURLUploadPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.URL == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body, expected {\"url\": \"...\"}"})
			return
		}
		resp, err := fetchRemote(payload.URL)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("Failed to fetch remote image: %v", err)})
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("Failed to fetch remote image: HTTP %d", resp.StatusCode)})
			return
		}
		imgBytes, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to read remote image"})
			return
		}
		imageReader = bytes.NewReader(imgBytes)
		originalFilename = payload.URL
	} else {
		// Raw binary stream body
		rawBytes, err := io.ReadAll(r.Body)
		if err != nil || len(rawBytes) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Empty or unreadable request body"})
			return
		}
		imageReader = bytes.NewReader(rawBytes)
		originalFilename = "binary-upload"
	}

	// Optimize image for the web: resize max to configured dimensions, encode to WebP
	webpBytes, width, height, err := s.processor.ProcessMaster(imageReader)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": fmt.Sprintf("Image processing failed: %v", err)})
		return
	}

	// Save master image and update metadata
	meta, err := s.storage.SaveMasterImage(id, webpBytes, width, height, originalFilename)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to save image: %v", err)})
		return
	}

	writeJSON(w, http.StatusOK, meta)
}

// GET /images/{id}: Get metadata info on an image (dimensions, weight/size)
func (s *Server) handleGetImageInfo(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	meta, err := s.storage.GetMetadata(id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Image not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, meta)
}

// GET /images/{id}/blob: Get binary WebP blob (with size options)
func (s *Server) handleGetImageBlob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	masterPath, err := s.storage.GetMasterImagePath(id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			http.Error(w, "Image not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrNotReady) {
			http.Error(w, "Image pending upload", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Check size options
	q := r.URL.Query()
	targetW := 0
	targetH := 0

	if wStr := q.Get("w"); wStr != "" {
		targetW, _ = strconv.Atoi(wStr)
	} else if wStr := q.Get("width"); wStr != "" {
		targetW, _ = strconv.Atoi(wStr)
	}

	if hStr := q.Get("h"); hStr != "" {
		targetH, _ = strconv.Atoi(hStr)
	} else if hStr := q.Get("height"); hStr != "" {
		targetH, _ = strconv.Atoi(hStr)
	}

	// Preset shortcuts
	if sizePreset := strings.ToLower(q.Get("size")); sizePreset != "" {
		switch sizePreset {
		case "thumb", "thumbnail":
			targetW = 160
		case "medium":
			targetW = 320
		case "large":
			targetW = 640
		}
	}

	var serveBytes []byte

	// If no resizing requested or requested size is equal/larger than master
	if targetW <= 0 && targetH <= 0 {
		serveBytes, err = os.ReadFile(masterPath)
		if err != nil {
			http.Error(w, "Failed to read image", http.StatusInternalServerError)
			return
		}
	} else {
		// Resized variant requested
		variantPath := s.storage.VariantImagePath(id, targetW, targetH)
		if cached, err := os.ReadFile(variantPath); err == nil {
			serveBytes = cached
		} else {
			// Generate resized variant
			resizedBytes, err := s.processor.ResizeFromMaster(masterPath, targetW, targetH)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to resize image: %v", err), http.StatusInternalServerError)
				return
			}
			_ = s.storage.SaveVariantImage(id, targetW, targetH, resizedBytes)
			serveBytes = resizedBytes
		}
	}

	// Compute ETag
	hash := md5.Sum(serveBytes)
	etag := `"` + hex.EncodeToString(hash[:]) + `"`

	// Check If-None-Match
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Content-Length", strconv.Itoa(len(serveBytes)))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", etag)

	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(serveBytes)
}

// DELETE /images/{id}: Delete image and variants from storage
func (s *Server) handleDeleteImage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.storage.DeleteImage(id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
