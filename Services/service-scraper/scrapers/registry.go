package scrapers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"
)

// ScraperOrder preserves the deterministic order of scrapers (matching Python dict insertion order).
var ScraperOrder = []string{
	"urban_comics",
	"panini",
	"morgen_bd",
	"mangetsu",
	"label619",
	"monsieur_toussaint_louverture",
}

var Scrapers = map[string]func() BaseScraper{
	"urban_comics":                  func() BaseScraper { return NewUrbanComicsScraper() },
	"panini":                        func() BaseScraper { return NewPaniniComicsScraper() },
	"morgen_bd":                     func() BaseScraper { return NewMorgenBDScraper() },
	"mangetsu":                      func() BaseScraper { return NewMangetsuScraper() },
	"label619":                      func() BaseScraper { return NewLabel619Scraper() },
	"monsieur_toussaint_louverture": func() BaseScraper { return NewMonsieurToussaintLouvertureScraper() },
}

func GetScraper(name string) (BaseScraper, error) {
	factory, ok := Scrapers[name]
	if !ok {
		return nil, fmt.Errorf("Unknown scraper: %s. Available: %v", name, ScraperOrder)
	}
	return factory(), nil
}

func getUserAgent() string {
	if ua := os.Getenv("USER_AGENT"); ua != "" {
		return ua
	}
	return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

func getRequestTimeout() time.Duration {
	if val := os.Getenv("REQUEST_TIMEOUT"); val != "" {
		if i, err := strconv.Atoi(val); err == nil && i > 0 {
			return time.Duration(i) * time.Second
		}
	}
	return 30 * time.Second
}

func newHTTPClient(timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = getRequestTimeout()
	}
	return &http.Client{
		Timeout: timeout,
	}
}
