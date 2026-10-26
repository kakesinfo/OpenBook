package scrapers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

var (
	reMorgenAlbumHref = regexp.MustCompile(`href=["'](/livres/[^"']+)["']`)
	reMorgenISBN      = regexp.MustCompile(`(97[89][-\s0-9]{10,15})`)
	reMorgenPrice     = regexp.MustCompile(`(?i)prix\s*:\s*([0-9]+)[,\.]([0-9]+)\s*€`)
	reMorgenPages     = regexp.MustCompile(`(?i)numérique\s*:\s*([0-9]+)`)
	reMorgenDate      = regexp.MustCompile(`(?i)parution\s*([0-9]{2}/[0-9]{2}/[0-9]{4})`)
	reMorgenAuthor    = regexp.MustCompile(`Black Orion([A-Za-zÀ-ÿ\s]+)prix`)
	reMorgenVol       = regexp.MustCompile(`(?i)tome\s*(\d+)`)
	reMorgenVolStrip  = regexp.MustCompile(`(?i)tome\s*\d+.*`)
	reHyphenOrSpace   = regexp.MustCompile(`[-\s]`)
)

type MorgenBDScraper struct{}

func NewMorgenBDScraper() *MorgenBDScraper {
	return &MorgenBDScraper{}
}

func (s *MorgenBDScraper) Name() string        { return "morgen_bd" }
func (s *MorgenBDScraper) DisplayName() string { return "Morgen BD" }
func (s *MorgenBDScraper) Description() string { return "Boutique & nouveautés indés Morgen" }
func (s *MorgenBDScraper) Color() string       { return "#8b5cf6" }

func (s *MorgenBDScraper) Scrape(
	maxItems int,
	fullScan bool,
	onBookFound func(ScrapedBook),
	isStopped func() bool,
) ([]ScrapedBook, error) {
	if maxItems <= 0 {
		maxItems = 50
	}

	var books []ScrapedBook
	baseURL := "https://www.morgen-bd.com"
	listingURL := fmt.Sprintf("%s/nos-albums", baseURL)

	client := newHTTPClient(getRequestTimeout())

	log.Printf("MorgenBD: Fetching listing %s", listingURL)
	req, err := http.NewRequest(http.MethodGet, listingURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", getUserAgent())
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("MorgenBD error: %v", err)
		return books, nil
	}
	bodyBytes, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil || resp.StatusCode != 200 {
		log.Printf("MorgenBD returned HTTP %d for %s", resp.StatusCode, listingURL)
		return books, nil
	}

	pageContent := string(bodyBytes)
	matches := reMorgenAlbumHref.FindAllStringSubmatch(pageContent, -1)
	seenPaths := make(map[string]bool)
	var relPaths []string
	for _, m := range matches {
		if len(m) > 1 && !seenPaths[m[1]] {
			seenPaths[m[1]] = true
			relPaths = append(relPaths, m[1])
		}
	}
	sort.Strings(relPaths)

	log.Printf("MorgenBD: Found %d album links", len(relPaths))

	for _, relPath := range relPaths {
		if isStopped != nil && isStopped() {
			break
		}
		if !fullScan && len(books) >= maxItems {
			break
		}
		bookURL := baseURL + relPath
		book := s.scrapeBookPage(client, bookURL)
		if book != nil {
			books = append(books, *book)
			if onBookFound != nil {
				onBookFound(*book)
			}
		}
	}

	log.Printf("MorgenBD: Finished, scraped %d books", len(books))
	return books, nil
}

func (s *MorgenBDScraper) scrapeBookPage(client *http.Client, urlStr string) *ScrapedBook {
	req, err := http.NewRequest(http.MethodGet, urlStr, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", getUserAgent())
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	bodyBytes, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil || resp.StatusCode != 200 {
		return nil
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil
	}

	// 1. Title
	title := ""
	doc.Find("h1, h2").EachWithBreak(func(_ int, h *goquery.Selection) bool {
		t := strings.TrimSpace(h.Text())
		low := strings.ToLower(t)
		if t != "" && !strings.Contains(low, "résumé") && !strings.Contains(low, "documentaire") && !strings.Contains(low, "auteurs") && !strings.Contains(low, "découvrir") && !strings.Contains(low, "série") && !strings.Contains(low, "morgen") {
			title = CleanText(t)
			return false
		}
		return true
	})

	if title == "" {
		parts := strings.Split(urlStr, "/livres/")
		slug := parts[len(parts)-1]
		title = CleanText(TitleCaseWords(strings.ReplaceAll(slug, "-", " ")))
	}

	// 2. Cover image
	coverURL := ""
	doc.Find("img").EachWithBreak(func(_ int, img *goquery.Selection) bool {
		src, _ := img.Attr("src")
		low := strings.ToLower(src)
		if strings.Contains(src, "CV_") || strings.Contains(low, "couv") || strings.Contains(src, "website-files.com") {
			if !strings.Contains(low, "favicon") && !strings.Contains(low, "icon") && !strings.Contains(low, "logo") && !strings.Contains(low, "whatssap") && !strings.Contains(low, "facebook") {
				coverURL = src
				return false
			}
		}
		return true
	})

	// 3. Text metadata
	fullText := doc.Text()

	isbn := ""
	if m := reMorgenISBN.FindStringSubmatch(fullText); len(m) > 1 {
		isbn = reHyphenOrSpace.ReplaceAllString(m[1], "")
	}

	price := 0
	if m := reMorgenPrice.FindStringSubmatch(fullText); len(m) > 1 {
		price, _ = strconv.Atoi(m[1])
	}

	pageCount := 0
	if m := reMorgenPages.FindStringSubmatch(fullText); len(m) > 1 {
		pageCount, _ = strconv.Atoi(m[1])
	}

	var releaseDate *time.Time
	if m := reMorgenDate.FindStringSubmatch(fullText); len(m) > 1 {
		if parsed, err := time.Parse("02/01/2006", m[1]); err == nil {
			releaseDate = &parsed
		}
	}
	if releaseDate == nil {
		now := time.Now()
		releaseDate = &now
	}

	// 4. Description
	description := ""
	doc.Find("p").EachWithBreak(func(_ int, p *goquery.Selection) bool {
		t := strings.TrimSpace(p.Text())
		low := strings.ToLower(t)
		if len([]rune(t)) > 60 && !strings.Contains(low, "cookie") && !strings.Contains(low, "droits réservés") && !strings.Contains(low, "newsletter") {
			description = CleanText(t)
			return false
		}
		return true
	})

	// 5. Authors
	var authors []ScrapedAuthor
	if m := reMorgenAuthor.FindStringSubmatch(fullText); len(m) > 1 {
		name := strings.TrimSpace(m[1])
		fn, ln := SplitAuthorName(name)
		if ln != "" {
			authors = append(authors, ScrapedAuthor{
				Firstname: fn,
				Lastname:  ln,
				Role:      "Writer",
			})
		}
	}

	// 6. Series & Volume
	seriesName := title
	var volume *int
	if m := reMorgenVol.FindStringSubmatch(title); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			volume = &v
		}
		seriesName = strings.Trim(reMorgenVolStrip.ReplaceAllString(title, ""), " -:")
	}

	return &ScrapedBook{
		Title:        TruncateString(title, 255),
		SeriesName:   TruncateString(seriesName, 255),
		Volume:       volume,
		ISBN:         isbn,
		EditorName:   "Morgen BD",
		CategoryName: "Bande dessinée",
		PageCount:    pageCount,
		Price:        price,
		Description:  description,
		CoverURL:     coverURL,
		ReleaseDate:  releaseDate,
		BookType:     "Cartonné",
		Authors:      authors,
		SourceURL:    urlStr,
	}
}
