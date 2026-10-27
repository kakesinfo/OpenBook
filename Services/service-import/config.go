package main

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL         string
	MediaServiceURL     string
	Host                string
	Port                string
	MaxMediaConcurrency int
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}

func LoadConfig() *Config {
	dbURL := getEnv("DATABASE_URL", "postgresql://strapi:strapi@project-postgres:5432/strapi?sslmode=disable")
	if !strings.Contains(dbURL, "sslmode=") {
		if strings.Contains(dbURL, "?") {
			dbURL += "&sslmode=disable"
		} else {
			dbURL += "?sslmode=disable"
		}
	}

	return &Config{
		DatabaseURL:         dbURL,
		MediaServiceURL:     strings.TrimRight(getEnv("MEDIA_SERVICE_URL", "http://project-media:5002"), "/"),
		Host:                getEnv("HOST", "0.0.0.0"),
		Port:                getEnv("PORT", "5003"),
		MaxMediaConcurrency: getEnvInt("MAX_MEDIA_CONCURRENCY", 8),
	}
}
