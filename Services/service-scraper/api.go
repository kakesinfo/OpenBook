package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"yet-another-library/service-scraper/scrapers"
)

type SourceToggleRequest struct {
	Enabled *bool `json:"enabled"`
}

type SplitSeriesRequest struct {
	SourceSeriesID int    `json:"source_series_id"`
	NewSeriesName  string `json:"new_series_name"`
	BookIDs        []int  `json:"book_ids"`
}

type LinkVariantRequest struct {
	ParentBookID   int   `json:"parent_book_id"`
	VariantBookIDs []int `json:"variant_book_ids"`
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "*")

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

func writeDetailError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]any{"detail": detail})
}

func NewRouter() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /{$}", handleRoot)
	mux.HandleFunc("GET /api/health", handleHealth)
	mux.HandleFunc("GET /api/status", handleStatus)
	mux.HandleFunc("GET /api/sources", handleGetSources)
	mux.HandleFunc("PUT /api/sources/{source}", handleUpdateSourceStatus)
	mux.HandleFunc("POST /api/scrape", handleTriggerScrape)
	mux.HandleFunc("POST /api/scrape/stop", handleStopScrape)
	mux.HandleFunc("POST /api/scrape/{source}", handleTriggerScrapeSource)
	mux.HandleFunc("POST /api/repair", handleRepairDatabase)
	mux.HandleFunc("POST /api/deduplicate", handleDeduplicateDatabase)
	mux.HandleFunc("GET /api/maintenance/stats", handleMaintenanceStats)
	mux.HandleFunc("GET /api/maintenance/conflicts", handleGetVolumeConflicts)
	mux.HandleFunc("POST /api/maintenance/split", handleSplitSeries)
	mux.HandleFunc("POST /api/maintenance/link-variant", handleLinkVariant)
	mux.HandleFunc("POST /api/maintenance/reconcile-variants", handleReconcileVariants)
	mux.HandleFunc("POST /api/maintenance/enrich-bnf", handleEnrichBnf)
	mux.HandleFunc("POST /api/enrich-bnf", handleEnrichBnf)
	mux.HandleFunc("POST /api/maintenance/verify-isbn", handleVerifyISBN)
	mux.HandleFunc("POST /api/verify-isbn", handleVerifyISBN)
	mux.HandleFunc("POST /api/maintenance/migrate-covers", handleMigrateCovers)
	mux.HandleFunc("POST /api/migrate-covers", handleMigrateCovers)
	mux.HandleFunc("GET /api/books", handleGetBooks)

	return corsMiddleware(mux)
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"service": "Yet Another Library - Comics Scraper",
		"status":  "online",
		"endpoints": map[string]string{
			"health":             "/api/health",
			"status":             "/api/status",
			"sources":            "GET /api/sources, PUT /api/sources/{source}",
			"trigger_all":        "POST /api/scrape?full=false",
			"trigger_source":     "POST /api/scrape/{source}?full=false",
			"repair_mojibake":    "POST /api/repair",
			"deduplicate":        "POST /api/deduplicate",
			"reconcile_variants": "POST /api/maintenance/reconcile-variants",
			"enrich_bnf":         "POST /api/maintenance/enrich-bnf",
			"verify_isbn":        "POST /api/maintenance/verify-isbn",
			"migrate_covers":     "POST /api/maintenance/migrate-covers",
			"maintenance_stats":  "GET /api/maintenance/stats",
			"recent_books":       "/api/books",
		},
		"sources": scrapers.ScraperOrder,
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if !db.CheckConnection() {
		writeDetailError(w, http.StatusServiceUnavailable, "Database connection unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":            "healthy",
		"database":          "connected",
		"scheduler_running": scraperManager.IsSchedulerRunning(),
	})
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, scraperManager.GetStatus())
}

func handleGetSources(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"sources": scraperManager.GetSources(),
	})
}

func handleUpdateSourceStatus(w http.ResponseWriter, r *http.Request) {
	source := r.PathValue("source")
	if _, ok := scrapers.Scrapers[source]; !ok {
		writeDetailError(w, http.StatusBadRequest, fmt.Sprintf("Invalid source '%s'. Available: %v", source, scrapers.ScraperOrder))
		return
	}

	var body SourceToggleRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}

	isEnabled := true
	if body.Enabled != nil {
		isEnabled = *body.Enabled
	} else if qEnabled := r.URL.Query().Get("enabled"); qEnabled != "" {
		low := strings.ToLower(strings.TrimSpace(qEnabled))
		isEnabled = low == "true" || low == "1" || low == "yes"
	}

	scraperManager.SetSourceEnabled(source, isEnabled)
	stateWord := "désactivée"
	if isEnabled {
		stateWord = "activée"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"source":  source,
		"enabled": isEnabled,
		"message": fmt.Sprintf("Source %s %s.", source, stateWord),
	})
}

func parseBoolQuery(r *http.Request, key string, defaultVal bool) bool {
	val := r.URL.Query().Get(key)
	if val == "" {
		return defaultVal
	}
	low := strings.ToLower(strings.TrimSpace(val))
	return low == "true" || low == "1" || low == "yes"
}

func handleTriggerScrape(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	selectedRaw := q.Get("sources")
	if selectedRaw == "" {
		selectedRaw = q.Get("source")
	}
	full := parseBoolQuery(r, "full", false)

	var sourceList []string
	if selectedRaw != "" {
		for _, part := range strings.Split(selectedRaw, ",") {
			p := strings.TrimSpace(part)
			if p == "" {
				continue
			}
			if _, ok := scrapers.Scrapers[p]; !ok {
				writeDetailError(w, http.StatusBadRequest, fmt.Sprintf("Invalid source '%s'. Available: %v", p, scrapers.ScraperOrder))
				return
			}
			sourceList = append(sourceList, p)
		}
	}

	result := scraperManager.TriggerScrape("", full, sourceList)
	writeJSON(w, http.StatusOK, result)
}

func handleStopScrape(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, scraperManager.StopScan())
}

func handleTriggerScrapeSource(w http.ResponseWriter, r *http.Request) {
	source := r.PathValue("source")
	if _, ok := scrapers.Scrapers[source]; !ok {
		writeDetailError(w, http.StatusBadRequest, fmt.Sprintf("Invalid source '%s'. Available: %v", source, scrapers.ScraperOrder))
		return
	}
	full := parseBoolQuery(r, "full", false)
	writeJSON(w, http.StatusOK, scraperManager.TriggerScrape(source, full, nil))
}

func handleRepairDatabase(w http.ResponseWriter, r *http.Request) {
	res, err := db.RepairMojibake()
	if err != nil {
		writeDetailError(w, http.StatusInternalServerError, err.Error())
		return
	}
	msg := "Réparation UTF-8 terminée avec succès."
	if res != nil {
		var parts []string
		if rb, _ := res["repaired_books"].(int); rb > 0 {
			parts = append(parts, fmt.Sprintf("%d tomes réparés", rb))
		}
		if rs, _ := res["repaired_series"].(int); rs > 0 {
			parts = append(parts, fmt.Sprintf("%d séries réparées", rs))
		}
		if md, _ := res["merged_duplicates"].(int); md > 0 {
			parts = append(parts, fmt.Sprintf("%d doublons fusionnés", md))
		}
		if len(parts) > 0 {
			msg = fmt.Sprintf("Réparation UTF-8 terminée : %s.", strings.Join(parts, ", "))
		} else {
			msg = "Vérification UTF-8 terminée : aucun texte corrompu détecté."
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": msg,
		"details": res,
	})
}

func handleDeduplicateDatabase(w http.ResponseWriter, r *http.Request) {
	merged, err := db.DeduplicateBooks(nil)
	if err != nil {
		writeDetailError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var msg string
	if merged > 0 {
		msg = fmt.Sprintf("Dédouplication terminée : %d tome(s) doublon(s) fusionné(s) et nettoyé(s).", merged)
	} else {
		msg = "Aucun tome en double détecté. La base de données est parfaitement propre !"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "success",
		"merged_count": merged,
		"message":      msg,
	})
}

func handleMaintenanceStats(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "success",
		"stats":  db.GetMaintenanceStats(),
	})
}

func handleGetVolumeConflicts(w http.ResponseWriter, r *http.Request) {
	conflicts := db.DetectVolumeConflicts()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "success",
		"count":     len(conflicts),
		"conflicts": conflicts,
	})
}

func handleSplitSeries(w http.ResponseWriter, r *http.Request) {
	var req SplitSeriesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeDetailError(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := db.SplitSeries(req.SourceSeriesID, req.NewSeriesName, req.BookIDs)
	if err != nil {
		writeDetailError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func handleLinkVariant(w http.ResponseWriter, r *http.Request) {
	var req LinkVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeDetailError(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := db.LinkAsVariant(req.ParentBookID, req.VariantBookIDs)
	if err != nil {
		writeDetailError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func handleReconcileVariants(w http.ResponseWriter, r *http.Request) {
	res, err := db.ReconcileVariants()
	if err != nil {
		writeDetailError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": "Réconciliation des variantes effectuée avec succès.",
		"details": res,
	})
}

func handleEnrichBnf(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l >= 1 && l <= 500 {
			limit = l
		}
	}
	res, err := db.EnrichBooksFromBnf(limit)
	if err != nil {
		writeDetailError(w, http.StatusInternalServerError, err.Error())
		return
	}
	enriched, _ := res["enriched"].(int)
	scanned, _ := res["scanned"].(int)
	var msg string
	if enriched > 0 {
		msg = fmt.Sprintf("Enrichissement BNF terminé : %d album(s) enrichi(s) sur %d analysé(s).", enriched, scanned)
	} else if scanned > 0 {
		msg = fmt.Sprintf("Enrichissement BNF terminé : %d album(s) analysé(s), aucune correspondance BNF trouvée.", scanned)
	} else {
		msg = "Tous les albums possèdent déjà un ISBN valide !"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": msg,
		"details": res,
	})
}

func handleVerifyISBN(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l >= 1 && l <= 500 {
			limit = l
		}
	}
	force := parseBoolQuery(r, "force", true)
	res, err := db.VerifyBooksFromBnf(limit, force)
	if err != nil {
		writeDetailError(w, http.StatusInternalServerError, err.Error())
		return
	}

	scanned, _ := res["scanned"].(int)
	verified, _ := res["verified_in_bnf"].(int)
	updated, _ := res["updated_count"].(int)
	pages, _ := res["pages_corrected"].(int)
	collections, _ := res["collections_added"].(int)
	authors, _ := res["authors_added"].(int)

	var parts []string
	if pages > 0 {
		parts = append(parts, fmt.Sprintf("%d page(s) corrigée(s)", pages))
	}
	if collections > 0 {
		parts = append(parts, fmt.Sprintf("%d collection(s) rattachée(s)", collections))
	}
	if authors > 0 {
		parts = append(parts, fmt.Sprintf("%d auteur(s) associé(s)", authors))
	}

	var msg string
	if updated > 0 {
		msg = fmt.Sprintf("Vérification BnF terminée : %d album(s) mis à jour (%s) sur %d analysé(s).", updated, strings.Join(parts, ", "), scanned)
	} else if scanned > 0 {
		msg = fmt.Sprintf("Vérification BnF terminée : %d album(s) analysé(s) (%d trouvés à la BnF), toutes les métadonnées sont déjà exactes !", scanned, verified)
	} else {
		msg = "Aucun album à vérifier."
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "success",
		"message": msg,
		"details": res,
	})
}

func handleMigrateCovers(w http.ResponseWriter, r *http.Request) {
	var limit *int
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l >= 1 && l <= 2000 {
			limit = &l
		}
	}
	res := db.MigrateCoversToUUID(limit, 8)
	writeJSON(w, http.StatusOK, res)
}

func handleGetBooks(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l >= 1 && l <= 100 {
			limit = l
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"count": limit,
		"books": db.GetRecentBooks(limit),
	})
}
