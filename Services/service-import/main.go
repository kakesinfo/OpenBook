package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := LoadConfig()

	log.Printf("[Main] Starting service-import on %s:%s", cfg.Host, cfg.Port)
	log.Printf("[Main] Target Database: %s", cfg.DatabaseURL)
	log.Printf("[Main] Media Service: %s", cfg.MediaServiceURL)

	db := NewDatabase(cfg.DatabaseURL)
	media := NewMediaClient(cfg.MediaServiceURL)
	importer := NewImporter(cfg, db, media)
	server := NewServer(cfg, importer)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.Routes(),
		ReadTimeout:  600 * time.Second,
		WriteTimeout: 600 * time.Second,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Main] Server failed to start: %v", err)
		}
	}()

	log.Printf("[Main] service-import is listening on http://%s", addr)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Main] Shutting down service-import...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("[Main] Forced shutdown: %v", err)
	}

	log.Println("[Main] Server exited cleanly.")
}
