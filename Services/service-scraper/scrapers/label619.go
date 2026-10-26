package scrapers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	reLabel619Vol      = regexp.MustCompile(`(?i)T(?:ome)?\s*0?(\d+)`)
	reLabel619VolStrip = regexp.MustCompile(`(?i)T(?:ome)?\s*0?\d+.*`)
	reLabel619Price    = regexp.MustCompile(`(\d+)(?:[,\.]\d+)?`)
	reLabel619ISBN     = regexp.MustCompile(`(97[89]\d{10})`)
)

type Label619Scraper struct{}

func NewLabel619Scraper() *Label619Scraper {
	return &Label619Scraper{}
}

func (s *Label619Scraper) Name() string        { return "label619" }
func (s *Label619Scraper) DisplayName() string { return "Label 619" }
func (s *Label619Scraper) Description() string {
	return "Catalogue officiel Label 619 (Mutafukaz, Rue de Sèvres, BD alternatives)"
}
func (s *Label619Scraper) Color() string { return "#ec4899" }

type label619Response struct {
	Data []map[string]any `json:"data"`
	Meta struct {
		Pagination struct {
			Page      int `json:"page"`
			PageSize  int `json:"pageSize"`
			PageCount int `json:"pageCount"`
			Total     int `json:"total"`
		} `json:"pagination"`
	} `json:"meta"`
}

func (s *Label619Scraper) Scrape(
	maxItems int,
	fullScan bool,
	onBookFound func(ScrapedBook),
	isStopped func() bool,
) ([]ScrapedBook, error) {
	if maxItems <= 0 {
		maxItems = 50
	}

	var books []ScrapedBook
	client := newHTTPClient(getRequestTimeout())
	seenTitles := make(map[string]bool)

	page := 1
	pageSize := 40
	apiBase := "https://label619.com/sk/api/editions"

	log.Printf("Label619: Scraping catalogue from https://label619.com/catalogue (full_scan=%v, max_items=%d)...", fullScan, maxItems)

	for {
		if isStopped != nil && isStopped() {
			log.Printf("Label619: Stop requested, halting scrape.")
			break
		}

		urlStr := fmt.Sprintf(
			"%s?sort[0]=date:desc&pagination[pageSize]=%d&pagination[page]=%d&populate[cover][populate]=*&populate[collections][populate]=*",
			apiBase, pageSize, page,
		)

		req, err := http.NewRequest(http.MethodGet, urlStr, nil)
		if err != nil {
			break
		}
		req.Header.Set("User-Agent", getUserAgent())
		req.Header.Set("Accept", "application/json, text/html, */*")
		req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Label619: Request error on page %d: %v", page, err)
			break
		}
		bodyBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil || resp.StatusCode != 200 {
			log.Printf("Label619: API returned status %d on page %d", resp.StatusCode, page)
			break
		}

		var payload label619Response
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			log.Printf("Label619: JSON decode error on page %d: %v", page, err)
			break
		}

		items := payload.Data
		pageCount := payload.Meta.Pagination.PageCount
		if pageCount == 0 {
			pageCount = 1
		}

		log.Printf(
			"Label619: Fetched catalogue page %d/%d (%d albums, total catalogue: %d)",
			page, pageCount, len(items), payload.Meta.Pagination.Total,
		)

		for _, item := range items {
			if isStopped != nil && isStopped() {
				break
			}

			rawTitle, _ := item["title"].(string)
			if rawTitle == "" {
				continue
			}

			title := CleanText(rawTitle)
			if title == "" || seenTitles[title] {
				continue
			}
			seenTitles[title] = true

			// Tome / Volume
			var volume *int
			if tomeVal, ok := item["tome"]; ok && tomeVal != nil {
				switch tv := tomeVal.(type) {
				case float64:
					v := int(tv)
					volume = &v
				case string:
					if v, err := strconv.Atoi(strings.TrimSpace(tv)); err == nil {
						volume = &v
					}
				}
			}
			if volume == nil {
				if m := reLabel619Vol.FindStringSubmatch(title); len(m) > 1 {
					if v, err := strconv.Atoi(m[1]); err == nil {
						volume = &v
					}
				}
			}

			// Series name
			seriesName := title
			if volume != nil {
				cleanedSeries := strings.Trim(reLabel619VolStrip.ReplaceAllString(title, ""), " -:")
				if cleanedSeries != "" {
					seriesName = CleanText(cleanedSeries)
				}
			}

			// Price
			price := 0
			if priceRaw, ok := item["price"]; ok && priceRaw != nil {
				priceStr := fmt.Sprintf("%v", priceRaw)
				if m := reLabel619Price.FindStringSubmatch(priceStr); len(m) > 1 {
					price, _ = strconv.Atoi(m[1])
				}
			}

			// ISBN from external store link
			link, _ := item["link"].(string)
			isbn := ""
			if m := reLabel619ISBN.FindStringSubmatch(link); len(m) > 1 {
				isbn = m[1]
			}

			// Cover image URL
			coverURL := ""
			if coverData, ok := item["cover"].(map[string]any); ok {
				urlPath := ""
				if formats, ok := coverData["formats"].(map[string]any); ok {
					for _, sz := range []string{"large", "medium", "small"} {
						if szMap, ok := formats[sz].(map[string]any); ok {
							if u, ok := szMap["url"].(string); ok && u != "" {
								urlPath = u
								break
							}
						}
					}
				}
				if urlPath == "" {
					urlPath, _ = coverData["url"].(string)
				}
				if urlPath != "" {
					if strings.HasPrefix(urlPath, "http") {
						coverURL = urlPath
					} else if strings.HasPrefix(urlPath, "/sk") {
						coverURL = "https://label619.com" + urlPath
					} else {
						coverURL = "https://label619.com/sk" + urlPath
					}
				}
			}

			// Release date
			var releaseDate *time.Time
			if dateStr, ok := item["date"].(string); ok && len(dateStr) >= 10 {
				if parsed, err := time.Parse("2006-01-02", dateStr[:10]); err == nil {
					releaseDate = &parsed
				}
			}
			if releaseDate == nil {
				now := time.Now()
				releaseDate = &now
			}

			// Summary / Description
			summaryRaw, _ := item["summary"].(string)
			description := CleanText(summaryRaw)
			if description == "" {
				description = fmt.Sprintf("Album Label 619 : %s", title)
			}

			// Authors (stored under Strapi 'collections' relation)
			var authors []ScrapedAuthor
			if collections, ok := item["collections"].([]any); ok {
				for _, col := range collections {
					if colMap, ok := col.(map[string]any); ok {
						authorName, _ := colMap["name"].(string)
						fn, ln := SplitAuthorName(authorName)
						if ln != "" {
							authors = append(authors, ScrapedAuthor{
								Firstname: fn,
								Lastname:  ln,
								Role:      "Writer",
							})
						}
					}
				}
			}

			sourceURL := link
			if sourceURL == "" {
				sourceURL = "https://label619.com/catalogue"
			}

			if seriesName == "" {
				seriesName = title
			}

			bookObj := ScrapedBook{
				Title:        TruncateString(title, 255),
				SeriesName:   TruncateString(seriesName, 255),
				Volume:       volume,
				ISBN:         isbn,
				EditorName:   "Label 619",
				CategoryName: "Comics",
				PageCount:    0,
				Price:        price,
				Description:  description,
				CoverURL:     coverURL,
				ReleaseDate:  releaseDate,
				BookType:     "Comics",
				Authors:      authors,
				SourceURL:    sourceURL,
			}

			books = append(books, bookObj)
			if onBookFound != nil {
				onBookFound(bookObj)
			}

			if !fullScan && len(books) >= maxItems {
				log.Printf("Label619: Reached max_items (%d), ending scan", maxItems)
				break
			}
		}

		if !fullScan && len(books) >= maxItems {
			break
		}
		if page >= pageCount || len(items) == 0 {
			break
		}
		page++
	}

	log.Printf("Label619: Finished catalogue scrape, collected %d books", len(books))
	return books, nil
}
