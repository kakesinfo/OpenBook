package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := LoadConfig()
	log.Printf("[Media Service] Starting on port %s, data dir: %s (max resolution: %dx%d, webp quality: %.0f)",
		cfg.Port, cfg.DataDir, cfg.MaxWidth, cfg.MaxHeight, cfg.WebpQuality)

	var db *Database
	if cfg.DatabaseURL != "" {
		var err error
		db, err = NewDatabase(cfg.DatabaseURL, cfg.DataDir)
		if err != nil {
			log.Printf("[Media Service] Warning: Failed to connect to database: %v", err)
		} else {
			defer db.Close()
			log.Printf("[Media Service] Successfully connected to dedicated media database")
		}
	}

	storage, err := NewStorage(cfg.DataDir, db)
	if err != nil {
		log.Fatalf("[Media Service] Failed to initialize storage: %v", err)
	}

	processor := NewProcessor(cfg.MaxWidth, cfg.MaxHeight, cfg.WebpQuality)
	server := NewServer(cfg, storage, processor)

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      server.Routes(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown channel
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Media Service] HTTP API listening on http://0.0.0.0:%s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Media Service] Listen error: %v", err)
		}
	}()

	<-stopChan
	log.Println("[Media Service] Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[Media Service] Shutdown error: %v", err)
	}
	log.Println("[Media Service] Server stopped gracefully")
}
