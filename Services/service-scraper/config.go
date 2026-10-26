package main

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL       string
	MediaServiceURL   string
	Host              string
	Port              string
	ScheduleHour      int
	ScheduleMinute    int
	ScrapeOnStartup   bool
	MaxBooksPerSource int
	RequestTimeout    int
	UserAgent         string
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val := os.Getenv(key); val != "" {
		low := strings.ToLower(strings.TrimSpace(val))
		return low == "true" || low == "1" || low == "yes"
	}
	return defaultVal
}

var settings = LoadConfig()

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
		DatabaseURL:       dbURL,
		MediaServiceURL:   strings.TrimRight(getEnv("MEDIA_SERVICE_URL", "http://project-media:5002"), "/"),
		Host:              getEnv("HOST", "0.0.0.0"),
		Port:              getEnv("PORT", "5001"),
		ScheduleHour:      getEnvInt("SCHEDULE_HOUR", 3),
		ScheduleMinute:    getEnvInt("SCHEDULE_MINUTE", 0),
		ScrapeOnStartup:   getEnvBool("SCRAPE_ON_STARTUP", true),
		MaxBooksPerSource: getEnvInt("MAX_BOOKS_PER_SOURCE", 30),
		RequestTimeout:    getEnvInt("REQUEST_TIMEOUT", 30),
		UserAgent: getEnv(
			"USER_AGENT",
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		),
	}
}
