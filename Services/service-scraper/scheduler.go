package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"yet-another-library/service-scraper/scrapers"
)

const sourcesConfigFilename = "sources_config.json"

type ScraperManager struct {
	mu               sync.Mutex
	isRunning        bool
	currentJob       *string
	lastRun          *time.Time
	lastStatus       string
	history          []map[string]any
	stopRequested    atomic.Bool
	disabledSources  map[string]bool
	liveScan         map[string]any
	schedulerRunning bool
	schedulerStopCh  chan struct{}
}

var scraperManager = NewScraperManager()

func getSourcesConfigPath() string {
	if _, err := os.Stat(sourcesConfigFilename); err == nil {
		return sourcesConfigFilename
	}
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), sourcesConfigFilename)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return sourcesConfigFilename
}

func NewScraperManager() *ScraperManager {
	sm := &ScraperManager{
		lastStatus:      "idle",
		history:         make([]map[string]any, 0),
		disabledSources: make(map[string]bool),
		liveScan: map[string]any{
			"is_running":           false,
			"job_name":             nil,
			"current_source":       nil,
			"current_source_name":  nil,
			"current_source_color": nil,
			"total_found":          0,
			"total_saved":          0,
			"recent_books":         make([]map[string]any, 0),
			"started_at":           nil,
			"ended_at":             nil,
			"last_error":           nil,
		},
	}
	sm.loadDisabledSources()
	return sm
}

func (m *ScraperManager) initRecentBooksFromDB() {
	dbBooks := db.GetRecentBooks(10)
	if len(dbBooks) == 0 {
		return
	}
	recent := make([]map[string]any, 0, len(dbBooks))
	for _, b := range dbBooks {
		srcName := "Catalogue"
		if ed, ok := b["editor_name"].(string); ok && ed != "" {
			srcName = ed
		}
		recent = append(recent, map[string]any{
			"id":           b["id"],
			"title":        b["title"],
			"series_name":  b["series_name"],
			"volume":       b["volume"],
			"isbn":         b["isbn"],
			"editor_name":  b["editor_name"],
			"cover_url":    b["cover_url"],
			"price":        b["price"],
			"authors":      []string{},
			"source_id":    nil,
			"source_name":  srcName,
			"source_color": "#6366f1",
			"found_at":     nil,
		})
	}
	m.liveScan["recent_books"] = recent
	m.liveScan["total_found"] = len(recent)
}

func (m *ScraperManager) loadDisabledSources() {
	cfgPath := getSourcesConfigPath()
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return
	}
	var parsed struct {
		DisabledSources []string `json:"disabled_sources"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		log.Printf("Could not load sources_config.json: %v", err)
		return
	}
	for _, s := range parsed.DisabledSources {
		m.disabledSources[s] = true
	}
}

func (m *ScraperManager) saveDisabledSources() {
	cfgPath := getSourcesConfigPath()
	list := make([]string, 0, len(m.disabledSources))
	for s, dis := range m.disabledSources {
		if dis {
			list = append(list, s)
		}
	}
	payload := map[string]any{"disabled_sources": list}
	bytesOut, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return
	}
	if err := os.WriteFile(cfgPath, bytesOut, 0644); err != nil {
		log.Printf("Could not save sources_config.json: %v", err)
	}
}

func (m *ScraperManager) SetSourceEnabled(source string, enabled bool) {
	m.mu.Lock()
	if enabled {
		delete(m.disabledSources, source)
	} else {
		m.disabledSources[source] = true
	}
	m.saveDisabledSources()
	m.mu.Unlock()
	log.Printf("Source '%s' status changed: enabled=%v", source, enabled)
}

func (m *ScraperManager) IsSourceEnabled(source string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return !m.disabledSources[source]
}

func (m *ScraperManager) GetSources() []map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.getSourcesLocked()
}

func (m *ScraperManager) getSourcesLocked() []map[string]any {
	result := make([]map[string]any, 0, len(scrapers.ScraperOrder))
	for _, sName := range scrapers.ScraperOrder {
		scr, err := scrapers.GetScraper(sName)
		if err != nil {
			continue
		}
		result = append(result, map[string]any{
			"id":      scr.Name(),
			"name":    scr.DisplayName(),
			"desc":    scr.Description(),
			"color":   scr.Color(),
			"enabled": !m.disabledSources[scr.Name()],
		})
	}
	return result
}

func (m *ScraperManager) StartScheduler() {
	m.mu.Lock()
	if m.schedulerRunning {
		m.mu.Unlock()
		return
	}
	m.initRecentBooksFromDB()
	m.schedulerRunning = true
	m.schedulerStopCh = make(chan struct{})
	stopCh := m.schedulerStopCh
	m.mu.Unlock()

	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), settings.ScheduleHour, settings.ScheduleMinute, 0, 0, now.Location())
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			waitDur := time.Until(next)
			timer := time.NewTimer(waitDur)
			select {
			case <-stopCh:
				timer.Stop()
				return
			case <-timer.C:
				m.RunFullScrape()
			}
		}
	}()

	log.Printf("Scheduler started: Daily scrape configured at %02d:%02d", settings.ScheduleHour, settings.ScheduleMinute)
}

func (m *ScraperManager) IsSchedulerRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.schedulerRunning
}

func (m *ScraperManager) Shutdown() {
	m.mu.Lock()
	if m.schedulerRunning && m.schedulerStopCh != nil {
		close(m.schedulerStopCh)
		m.schedulerRunning = false
	}
	m.mu.Unlock()
}

func (m *ScraperManager) StopScan() map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.isRunning {
		return map[string]any{
			"status":  "not_running",
			"message": "Aucun scan n'est actuellement en cours.",
		}
	}
	m.stopRequested.Store(true)
	return map[string]any{
		"status":  "stopping",
		"message": "Arrêt du scan demandé.",
	}
}

func (m *ScraperManager) TriggerScrape(source string, fullScan bool, sources []string) map[string]any {
	m.mu.Lock()
	if m.isRunning {
		var curJob any
		if m.currentJob != nil {
			curJob = *m.currentJob
		}
		m.mu.Unlock()
		return map[string]any{
			"status":      "already_running",
			"current_job": curJob,
			"message":     "A scraping job is already in progress.",
		}
	}

	m.isRunning = true
	m.stopRequested.Store(false)

	var targetDesc string
	var firstSrc string
	if len(sources) > 0 {
		targetDesc = strings.Join(sources, ", ")
		firstSrc = sources[0]
	} else if source != "" {
		targetDesc = source
		firstSrc = strings.TrimSpace(strings.Split(source, ",")[0])
	} else {
		targetDesc = "all active"
		for _, s := range scrapers.ScraperOrder {
			if !m.disabledSources[s] {
				firstSrc = s
				break
			}
		}
	}

	jobStr := targetDesc
	if fullScan {
		jobStr += " (full)"
	}
	m.currentJob = &jobStr
	m.lastStatus = "running"

	firstSrcName := targetDesc
	firstSrcColor := "#6366f1"
	if firstSrc != "" {
		if scr, err := scrapers.GetScraper(firstSrc); err == nil {
			firstSrcName = scr.DisplayName()
			firstSrcColor = scr.Color()
		}
	}

	var firstSrcAny any
	if firstSrc != "" {
		firstSrcAny = firstSrc
	}

	m.liveScan = map[string]any{
		"is_running":           true,
		"job_name":             targetDesc,
		"current_source":       firstSrcAny,
		"current_source_name":  firstSrcName,
		"current_source_color": firstSrcColor,
		"total_found":          0,
		"total_saved":          0,
		"recent_books":         make([]map[string]any, 0),
		"started_at":           time.Now().Format(time.RFC3339),
		"ended_at":             nil,
		"last_error":           nil,
	}
	m.mu.Unlock()

	go m.ExecuteScrape(source, fullScan, sources)

	modeStr := "standard scan"
	if fullScan {
		modeStr = "full catalog scan"
	}

	return map[string]any{
		"status":    "started",
		"source":    targetDesc,
		"full_scan": fullScan,
		"message":   fmt.Sprintf("Scraping job started for %s (%s).", targetDesc, modeStr),
	}
}

func (m *ScraperManager) RunFullScrape() {
	log.Printf("Executing scheduled daily scrape")
	m.ExecuteScrape("", false, nil)
}

func (m *ScraperManager) ExecuteScrape(source string, fullScan bool, sources []string) {
	startTime := time.Now()

	var sourcesToRun []string
	m.mu.Lock()
	if len(sources) > 0 {
		for _, s := range sources {
			if _, ok := scrapers.Scrapers[s]; ok {
				sourcesToRun = append(sourcesToRun, s)
			}
		}
	} else if source != "" {
		for _, part := range strings.Split(source, ",") {
			p := strings.TrimSpace(part)
			if _, ok := scrapers.Scrapers[p]; ok {
				sourcesToRun = append(sourcesToRun, p)
			}
		}
	} else {
		for _, s := range scrapers.ScraperOrder {
			if !m.disabledSources[s] {
				sourcesToRun = append(sourcesToRun, s)
			}
		}
	}
	m.mu.Unlock()

	// 1. Clean existing mojibake
	if _, err := db.RepairMojibake(); err != nil {
		log.Printf("Error running mojibake repair: %v", err)
	}

	sourceLabel := "none"
	if len(sourcesToRun) > 0 {
		sourceLabel = strings.Join(sourcesToRun, ", ")
	} else if source != "" {
		sourceLabel = source
	}

	resultsMap := make(map[string]any)
	errorsList := make([]string, 0)
	summary := map[string]any{
		"start_time":    startTime.Format(time.RFC3339),
		"source":        sourceLabel,
		"full_scan":     fullScan,
		"results":       resultsMap,
		"total_scraped": 0,
		"total_saved":   0,
		"errors":        errorsList,
	}

	m.mu.Lock()
	var firstS any
	var firstName any
	firstColor := "#6366f1"
	if len(sourcesToRun) > 0 {
		firstS = sourcesToRun[0]
		firstName = sourcesToRun[0]
		if scr, err := scrapers.GetScraper(sourcesToRun[0]); err == nil {
			firstName = scr.DisplayName()
			firstColor = scr.Color()
		}
	}
	m.isRunning = true
	m.liveScan["is_running"] = true
	m.liveScan["job_name"] = sourceLabel
	m.liveScan["current_source"] = firstS
	m.liveScan["current_source_name"] = firstName
	m.liveScan["current_source_color"] = firstColor
	m.liveScan["total_found"] = 0
	m.liveScan["total_saved"] = 0
	m.liveScan["recent_books"] = make([]map[string]any, 0)
	m.liveScan["started_at"] = startTime.Format(time.RFC3339)
	m.liveScan["ended_at"] = nil
	m.liveScan["last_error"] = nil
	m.mu.Unlock()

	log.Printf("Starting scrape process for sources: %v (full_scan=%v)", sourcesToRun, fullScan)

	totalScraped := 0
	totalSaved := 0
	cancelled := false

	defer func() {
		now := time.Now()
		m.mu.Lock()
		m.isRunning = false
		m.currentJob = nil
		m.lastRun = &now
		if st, ok := summary["status"].(string); ok && st != "" {
			m.lastStatus = st
		} else {
			m.lastStatus = "idle"
		}
		m.liveScan["is_running"] = false
		m.liveScan["current_source"] = nil
		m.liveScan["ended_at"] = now.Format(time.RFC3339)

		m.history = append([]map[string]any{summary}, m.history...)
		if len(m.history) > 20 {
			m.history = m.history[:20]
		}
		m.mu.Unlock()

		log.Printf(
			"Scrape process ended: %d scraped, %d saved in %v",
			summary["total_scraped"],
			summary["total_saved"],
			summary["status"],
		)
	}()

	for _, sName := range sourcesToRun {
		if m.stopRequested.Load() {
			log.Printf("Scrape halted early by user request before running %s", sName)
			summary["status"] = "cancelled"
			cancelled = true
			break
		}

		scr, err := scrapers.GetScraper(sName)
		if err != nil {
			continue
		}

		log.Printf("Running scraper: %s", sName)
		m.mu.Lock()
		m.liveScan["current_source"] = sName
		m.liveScan["current_source_name"] = scr.DisplayName()
		m.liveScan["current_source_color"] = scr.Color()
		m.mu.Unlock()

		limit := settings.MaxBooksPerSource
		if fullScan {
			limit = 50000
		}

		var (
			cbMu            sync.Mutex
			savedThisSource = 0
			seenInCallback  = make(map[string]bool)
		)

		onBookFound := func(b scrapers.ScrapedBook) {
			if m.stopRequested.Load() {
				return
			}
			bookCopy := b
			bookID := db.UpsertBook(&bookCopy)
			isSaved := bookID != nil
			ident := bookCopy.ISBN
			if ident == "" {
				ident = bookCopy.Title
			}

			cbMu.Lock()
			if isSaved && !seenInCallback[ident] {
				seenInCallback[ident] = true
				savedThisSource++
			}
			cbMu.Unlock()

			m.mu.Lock()
			tf, _ := m.liveScan["total_found"].(int)
			m.liveScan["total_found"] = tf + 1
			if isSaved {
				ts, _ := m.liveScan["total_saved"].(int)
				m.liveScan["total_saved"] = ts + 1
			}

			edName := bookCopy.EditorName
			if edName == "" {
				edName = scr.DisplayName()
			}
			authorStrings := make([]string, 0, len(bookCopy.Authors))
			for _, a := range bookCopy.Authors {
				if a.Lastname != "" {
					authorStrings = append(authorStrings, strings.TrimSpace(fmt.Sprintf("%s %s", a.Firstname, a.Lastname)))
				}
			}

			var bidVal, volVal, isbnVal, covVal any
			if bookID != nil {
				bidVal = *bookID
			}
			if bookCopy.Volume != nil {
				volVal = *bookCopy.Volume
			}
			if bookCopy.ISBN != "" {
				isbnVal = bookCopy.ISBN
			}
			if bookCopy.CoverURL != "" {
				covVal = bookCopy.CoverURL
			}

			bookItem := map[string]any{
				"id":           bidVal,
				"title":        bookCopy.Title,
				"series_name":  bookCopy.SeriesName,
				"volume":       volVal,
				"isbn":         isbnVal,
				"editor_name":  edName,
				"cover_url":    covVal,
				"price":        bookCopy.Price,
				"page_count":   bookCopy.PageCount,
				"authors":      authorStrings,
				"source_id":    sName,
				"source_name":  scr.DisplayName(),
				"source_color": scr.Color(),
				"found_at":     time.Now().Format("15:04:05"),
			}

			recList, _ := m.liveScan["recent_books"].([]map[string]any)
			recList = append([]map[string]any{bookItem}, recList...)
			if len(recList) > 10 {
				recList = recList[:10]
			}
			m.liveScan["recent_books"] = recList
			m.mu.Unlock()
		}

		books, scrapeErr := scr.Scrape(limit, fullScan, onBookFound, func() bool {
			return m.stopRequested.Load()
		})

		if m.stopRequested.Load() {
			log.Printf("Scraper %s stopped early by user request", sName)
			resultsMap[sName] = map[string]any{
				"scraped": len(books),
				"saved":   savedThisSource,
				"status":  "cancelled",
			}
			summary["status"] = "cancelled"
			cancelled = true
			break
		}

		if scrapeErr != nil {
			errMsg := fmt.Sprintf("Error in scraper %s: %v", sName, scrapeErr)
			log.Printf("%s", errMsg)
			errorsList = append(errorsList, errMsg)
			summary["errors"] = errorsList
			resultsMap[sName] = map[string]any{
				"scraped": 0,
				"saved":   0,
				"status":  "error",
				"error":   scrapeErr.Error(),
			}
			m.mu.Lock()
			m.liveScan["last_error"] = scrapeErr.Error()
			m.mu.Unlock()
			continue
		}

		// Safeguard: in case any book was not captured via callback
		for _, b := range books {
			ident := b.ISBN
			if ident == "" {
				ident = b.Title
			}
			cbMu.Lock()
			seen := seenInCallback[ident]
			cbMu.Unlock()
			if !seen {
				onBookFound(b)
			}
		}

		resultsMap[sName] = map[string]any{
			"scraped": len(books),
			"saved":   savedThisSource,
			"status":  "success",
		}
		totalScraped += len(books)
		totalSaved += savedThisSource
		summary["total_scraped"] = totalScraped
		summary["total_saved"] = totalSaved
		log.Printf("Scraper %s finished: %d scraped, %d saved/updated", sName, len(books), savedThisSource)
	}

	// Post-scan: reconcile and couple variants across all additions
	log.Printf("Executing post-scan variant coupling pass...")
	if recRes, err := db.ReconcileVariants(); err == nil {
		summary["variant_reconciliation"] = recRes
		log.Printf("Variant coupling pass completed: %v", recRes)
	} else {
		log.Printf("Error during post-scan variant coupling pass: %v", err)
	}

	summary["end_time"] = time.Now().Format(time.RFC3339)
	if !cancelled {
		if len(errorsList) == 0 {
			summary["status"] = "success"
		} else {
			summary["status"] = "completed_with_errors"
		}
	}
}

func (m *ScraperManager) GetStatus() map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()

	var curJob any
	if m.currentJob != nil {
		curJob = *m.currentJob
	}
	var lastRun any
	if m.lastRun != nil {
		lastRun = m.lastRun.Format(time.RFC3339)
	}

	disabledList := make([]string, 0)
	enabledList := make([]string, 0)
	for _, s := range scrapers.ScraperOrder {
		if m.disabledSources[s] {
			disabledList = append(disabledList, s)
		} else {
			enabledList = append(enabledList, s)
		}
	}

	recentHist := m.history
	if len(recentHist) > 5 {
		recentHist = recentHist[:5]
	}

	return map[string]any{
		"is_running":        m.isRunning,
		"current_job":       curJob,
		"last_run":          lastRun,
		"last_status":       m.lastStatus,
		"sources":           m.getSourcesLocked(),
		"available_sources": scrapers.ScraperOrder,
		"disabled_sources":  disabledList,
		"enabled_sources":   enabledList,
		"schedule": map[string]any{
			"daily_at":          fmt.Sprintf("%02d:%02d", settings.ScheduleHour, settings.ScheduleMinute),
			"scrape_on_startup": settings.ScrapeOnStartup,
		},
		"recent_history": recentHist,
		"live_scan":      m.liveScan,
	}
}
