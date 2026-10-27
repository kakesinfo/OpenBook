package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Server struct {
	config   *Config
	importer *Importer
}

func NewServer(cfg *Config, imp *Importer) *Server {
	return &Server{
		config:   cfg,
		importer: imp,
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-User-Id")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")

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
			"service": "service-import",
		})
	})

	// Import Bookmory backup via file upload
	mux.HandleFunc("POST /api/import/bookmory", s.handleImportBookmoryMultipart)

	// Import Bookmory backup from local file path (for testing or CLI)
	mux.HandleFunc("POST /api/import/bookmory/local", s.handleImportBookmoryLocal)

	// Job status polling
	mux.HandleFunc("GET /api/import/status/{id}", s.handleGetImportStatus)

	return corsMiddleware(mux)
}

func (s *Server) parseUserID(r *http.Request) int {
	// 1. Header X-User-Id
	if h := r.Header.Get("X-User-Id"); h != "" {
		if uid, err := strconv.Atoi(h); err == nil && uid > 0 {
			return uid
		}
	}
	// 2. Query param user_id
	if q := r.URL.Query().Get("user_id"); q != "" {
		if uid, err := strconv.Atoi(q); err == nil && uid > 0 {
			return uid
		}
	}
	// 3. Form value user_id
	if f := r.FormValue("user_id"); f != "" {
		if uid, err := strconv.Atoi(f); err == nil && uid > 0 {
			return uid
		}
	}
	// Default to 1 (main user)
	return 1
}

// POST /api/import/bookmory
func (s *Server) handleImportBookmoryMultipart(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(128 << 20); err != nil { // up to 128 MB
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Failed to parse multipart form: " + err.Error()})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		file, header, err = r.FormFile("backup")
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing file field ('file' or 'backup')"})
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".bookmory") && !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Le fichier doit avoir l'extension .bookmory ou .zip"})
		return
	}

	// Save to temp file
	tempDir, err := os.MkdirTemp("", "import_upload_*")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create temp directory: " + err.Error()})
		return
	}

	tempFilePath := filepath.Join(tempDir, header.Filename)
	out, err := os.Create(tempFilePath)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to save uploaded file: " + err.Error()})
		return
	}

	if _, err := io.Copy(out, file); err != nil {
		_ = out.Close()
		_ = os.RemoveAll(tempDir)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to write uploaded file: " + err.Error()})
		return
	}
	_ = out.Close()

	userID := s.parseUserID(r)
	job := s.importer.CreateJob(userID)

	wait := r.URL.Query().Get("wait") == "true" || r.FormValue("wait") == "true"
	if wait {
		s.importer.RunImportSync(job, tempFilePath)
		_ = os.RemoveAll(tempDir)
		writeJSON(w, http.StatusOK, &ImportResponse{
			Success: job.Status == "completed",
			Message: fmt.Sprintf("Import terminé: %d créés, %d mis à jour", job.CreatedBooks, job.UpdatedBooks),
			Job:     job,
		})
		return
	}

	// Run in background and clean up temp file after job completes
	go func() {
		defer os.RemoveAll(tempDir)
		s.importer.RunImportSync(job, tempFilePath)
	}()

	writeJSON(w, http.StatusAccepted, &ImportResponse{
		Success: true,
		Message: "Import démarré",
		Job:     job,
	})
}

// POST /api/import/bookmory/local
func (s *Server) handleImportBookmoryLocal(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		FilePath string `json:"file_path"`
		UserID   int    `json:"user_id"`
		Wait     bool   `json:"wait"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	if payload.FilePath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file_path is required"})
		return
	}

	if _, err := os.Stat(payload.FilePath); os.IsNotExist(err) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "File does not exist: " + payload.FilePath})
		return
	}

	userID := payload.UserID
	if userID <= 0 {
		userID = 1
	}

	job := s.importer.CreateJob(userID)

	if payload.Wait {
		s.importer.RunImportSync(job, payload.FilePath)
		writeJSON(w, http.StatusOK, &ImportResponse{
			Success: job.Status == "completed",
			Message: fmt.Sprintf("Import terminé: %d créés, %d mis à jour", job.CreatedBooks, job.UpdatedBooks),
			Job:     job,
		})
		return
	}

	s.importer.RunImportAsync(job, payload.FilePath)

	writeJSON(w, http.StatusAccepted, &ImportResponse{
		Success: true,
		Message: "Import local démarré",
		Job:     job,
	})
}

// GET /api/import/status/{id}
func (s *Server) handleGetImportStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing job id"})
		return
	}

	job := s.importer.GetJob(id)
	if job == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Job not found"})
		return
	}

	writeJSON(w, http.StatusOK, job)
}
