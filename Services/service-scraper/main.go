package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func runCLI(source string, fullScan bool) {
	log.Printf("[Scraper Service] Running scraper in CLI mode (immediate execution, full_scan=%v)...", fullScan)
	scraperManager.ExecuteScrape(source, fullScan, nil)
	log.Println("[Scraper Service] CLI execution completed.")
}

func runServer() {
	addr := fmt.Sprintf("%s:%s", settings.Host, settings.Port)
	log.Printf("[Scraper Service] Starting Scraper Service on %s...", addr)

	// 1. Repair any existing mojibake and reconcile variants in DB
	if _, err := db.RepairMojibake(); err != nil {
		log.Printf("[Scraper Service] Startup DB repair error: %v", err)
	}
	if _, err := db.ReconcileVariants(); err != nil {
		log.Printf("[Scraper Service] Startup variant reconciliation error: %v", err)
	}

	// 2. Start Scheduler
	scraperManager.StartScheduler()
	defer scraperManager.Shutdown()

	// 3. Scrape on startup if enabled
	if settings.ScrapeOnStartup {
		log.Println("[Scraper Service] SCRAPE_ON_STARTUP is enabled: initiating background startup scrape...")
		scraperManager.TriggerScrape("", false, nil)
	}

	// 4. Start Web API Server
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      NewRouter(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 15 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Scraper Service] HTTP API listening on http://%s", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Scraper Service] Listen error: %v", err)
		}
	}()

	<-stopChan
	log.Println("[Scraper Service] Shutting down scraper service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[Scraper Service] Shutdown error: %v", err)
	}
	db.Close()
	log.Println("[Scraper Service] Server stopped gracefully")
}

func main() {
	nowFlag := flag.Bool("now", false, "Run scraping immediately and exit (CLI mode)")
	sourceFlag := flag.String("source", "", "Specific source to scrape (urban_comics, panini, morgen_bd, mangetsu, label619, monsieur_toussaint_louverture)")
	fullFlag := flag.Bool("full", false, "Crawl full catalog across all pages")
	enrichBnfFlag := flag.Bool("enrich-bnf", false, "Run BNF catalog metadata & ISBN enrichment and exit")
	verifyISBNFlag := flag.Bool("verify-isbn", false, "Verify book metadata (pages, collection, authors) with BNF for all ISBNs and exit")
	repairFlag := flag.Bool("repair", false, "Run database UTF-8 mojibake repair and variant reconciliation and exit")

	flag.Parse()

	switch {
	case *verifyISBNFlag:
		log.Println("[Scraper Service] Running BNF ISBN metadata verification...")
		res, err := db.VerifyBooksFromBnf(100, true)
		if err != nil {
			log.Fatalf("[Scraper Service] BNF ISBN verification failed: %v", err)
		}
		log.Printf("[Scraper Service] BNF ISBN verification completed: %v", res)
	case *enrichBnfFlag:
		log.Println("[Scraper Service] Running BNF catalog enrichment...")
		res, err := db.EnrichBooksFromBnf(100)
		if err != nil {
			log.Fatalf("[Scraper Service] BNF enrichment failed: %v", err)
		}
		log.Printf("[Scraper Service] BNF enrichment completed: %v", res)
	case *repairFlag:
		log.Println("[Scraper Service] Running database repair (mojibake and variants)...")
		_, _ = db.RepairMojibake()
		_, _ = db.ReconcileVariants()
		log.Println("[Scraper Service] Repair finished.")
	case *nowFlag:
		runCLI(*sourceFlag, *fullFlag)
	default:
		runServer()
	}
}
