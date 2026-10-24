package main

import (
	"os"
	"strconv"
)

type Config struct {
	Port        string
	DataDir     string
	MaxWidth    int
	MaxHeight   int
	WebpQuality float32
	DatabaseURL string
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

func getEnvFloat(key string, defaultVal float32) float32 {
	if val := os.Getenv(key); val != "" {
		if f, err := strconv.ParseFloat(val, 32); err == nil {
			return float32(f)
		}
	}
	return defaultVal
}

func LoadConfig() *Config {
	return &Config{
		Port:        getEnv("PORT", "5002"),
		DataDir:     getEnv("DATA_DIR", "/data/media"),
		MaxWidth:    getEnvInt("MAX_WIDTH", 640),
		MaxHeight:   getEnvInt("MAX_HEIGHT", 960),
		WebpQuality: getEnvFloat("WEBP_QUALITY", 82.0),
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://strapi:strapi@project-postgres:5432/strapi?sslmode=disable"),
	}
}
