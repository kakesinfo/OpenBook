package scrapers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

var PaniniCatalogURLs = []string{
	"https://www.panini.fr/shp_fra_fr/comics/marvel.html",
	"https://www.panini.fr/shp_fra_fr/comics/star-wars.html",
	"https://www.panini.fr/shp_fra_fr/comics/disney.html",
	"https://www.panini.fr/shp_fra_fr/comics/autres-comics.html",
}

var (
	rePaniniJSRedirect = regexp.MustCompile(`decodeURIComponent\(['"]([^'"]+)['"]\)`)
	rePaniniAltPrefix  = regexp.MustCompile(`(?i)^Panini:\s*Comics[_\s]*`)
	rePaniniPrice      = regexp.MustCompile(`(\d+)[,\.]\d+`)
	rePaniniVarURL     = regexp.MustCompile(`(?i)-[a-zA-Z0-9]+v-[a-zA-Z0-9]+\.html`)
	rePaniniISBN13     = regexp.MustCompile(`(97[89]\d{10})`)
)

type PaniniComicsScraper struct{}

func NewPaniniComicsScraper() *PaniniComicsScraper {
	return &PaniniComicsScraper{}
}

func (s *PaniniComicsScraper) Name() string        { return "panini" }
func (s *PaniniComicsScraper) DisplayName() string { return "Panini Comics" }
func (s *PaniniComicsScraper) Description() string {
	return "Marvel, Star Wars, Disney, Autres Comics"
}
func (s *PaniniComicsScraper) Color() string { return "#ef4444" }

func resolveURL(baseStr, refStr string) string {
	if refStr == "" {
		return ""
	}
	if baseStr == "" {
		return refStr
	}
	b, err := url.Parse(baseStr)
	if err != nil {
		return refStr
	}
	r, err := url.Parse(refStr)
	if err != nil {
		return refStr
	}
	return b.ResolveReference(r).String()
}

func ExtractPaniniNextPageURL(doc *goquery.Document, currentURL string) string {
	items := doc.Find("div.pages ul.pages-items li.item")
	if items.Length() == 0 {
		return ""
	}

	// 1. Look for the next-page item (.pages-item-next or link with class next or text Suivant)
	var nextURL string
	items.EachWithBreak(func(_ int, item *goquery.Selection) bool {
		if item.HasClass("pages-item-next") {
			if a := item.Find("a[href]").First(); a.Length() > 0 {
				if href, ok := a.Attr("href"); ok && href != "" {
					nextURL = resolveURL(currentURL, href)
					return false
				}
			}
		}

		if aNext := item.Find("a.next").First(); aNext.Length() > 0 {
			if href, ok := aNext.Attr("href"); ok && href != "" {
				nextURL = resolveURL(currentURL, href)
				return false
			}
		}

		txt := strings.ToLower(strings.TrimSpace(item.Text()))
		if strings.Contains(txt, "suivant") || strings.Contains(txt, "next") {
			if a := item.Find("a[href]").First(); a.Length() > 0 {
				if href, ok := a.Attr("href"); ok && href != "" {
					nextURL = resolveURL(currentURL, href)
					return false
				}
			}
		}
		return true
	})

	if nextURL != "" {
		return nextURL
	}

	// 2. Fallback: inspect items in sequence to find the item right after 'current'
	foundCurrent := false
	items.EachWithBreak(func(_ int, item *goquery.Selection) bool {
		if item.HasClass("current") {
			foundCurrent = true
			return true
		}
		if foundCurrent && !item.HasClass("pages-item-previous") {
			if a := item.Find("a[href]").First(); a.Length() > 0 {
				if href, ok := a.Attr("href"); ok && href != "" {
					nextURL = resolveURL(currentURL, href)
					return false
				}
			}
		}
		return true
	})

	return nextURL
}

func (s *PaniniComicsScraper) fetchPageHTML(client *http.Client, targetURL string) string {
	currentURL := targetURL
	for i := 0; i < 5; i++ {
		req, err := http.NewRequest(http.MethodGet, currentURL, nil)
		if err != nil {
			log.Printf("Panini: request build error for %s: %v", currentURL, err)
			return ""
		}
		req.Header.Set("User-Agent", getUserAgent())
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Panini: request error for %s: %v", currentURL, err)
			return ""
		}
		bodyBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return ""
		}
		if resp.StatusCode != 200 {
			log.Printf("Panini returned HTTP %d for %s", resp.StatusCode, currentURL)
			return ""
		}

		htmlContent := string(bodyBytes)
		if m := rePaniniJSRedirect.FindStringSubmatch(htmlContent); len(m) > 1 {
			if redirectPath, err := url.QueryUnescape(m[1]); err == nil {
				finalReqURL := currentURL
				if resp.Request != nil && resp.Request.URL != nil {
					finalReqURL = resp.Request.URL.String()
				}
				currentURL = resolveURL(finalReqURL, redirectPath)
				continue
			}
		}
		return htmlContent
	}
	return ""
}

func (s *PaniniComicsScraper) ParseCard(card *goquery.Selection, baseURL string) *ScrapedBook {
	rawTitle := ""
	prodURL := ""

	card.Find("a[href]").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		t := strings.TrimSpace(a.Text())
		low := strings.ToLower(t)
		if t != "" && !strings.Contains(low, "liste d") && !strings.Contains(low, "panier") && !strings.Contains(low, "aperçu") && !strings.Contains(low, "voir") {
			rawTitle = t
			href, _ := a.Attr("href")
			if baseURL != "" {
				prodURL = resolveURL(baseURL, href)
			} else {
				prodURL = href
			}
			return false
		}
		return true
	})

	if rawTitle == "" {
		img := card.Find("img").First()
		if img.Length() > 0 {
			if alt, ok := img.Attr("alt"); ok && alt != "" {
				rawTitle = strings.TrimSpace(rePaniniAltPrefix.ReplaceAllString(alt, ""))
			}
		}
	}

	if rawTitle == "" {
		return nil
	}

	cleanTitle := CleanText(rawTitle)
	if cleanTitle == "" {
		return nil
	}

	// Price
	price := 0
	priceTag := card.Find("span.price").First()
	if priceTag.Length() > 0 {
		priceText := strings.TrimSpace(priceTag.Text())
		if m := rePaniniPrice.FindStringSubmatch(priceText); len(m) > 1 {
			price, _ = strconv.Atoi(m[1])
		}
	}

	// Cover Image
	coverURL := ""
	imgTag := card.Find("img.product-image-photo, img[class*='product-image-photo']").First()
	if imgTag.Length() == 0 {
		imgTag = card.Find("img").First()
	}
	if imgTag.Length() > 0 {
		if src, ok := imgTag.Attr("src"); ok && src != "" {
			coverURL = src
		} else if dsrc, ok := imgTag.Attr("data-src"); ok && dsrc != "" {
			coverURL = dsrc
		}
		if coverURL != "" {
			coverURL = strings.Split(coverURL, "?")[0]
		}
	}

	// SKU
	skuVal := ""
	skuEl := card.Find("[data-product-sku]").First()
	if skuEl.Length() > 0 {
		if v, ok := skuEl.Attr("data-product-sku"); ok {
			skuVal = strings.TrimSpace(v)
		}
	}

	// Variant detection
	isVariant := IsVariantBook(cleanTitle, coverURL, skuVal)
	if !isVariant && prodURL != "" && rePaniniVarURL.MatchString(prodURL) {
		isVariant = true
	}

	if isVariant && !IsVariantTitle(cleanTitle) {
		cleanTitle = fmt.Sprintf("%s - Edition collector", cleanTitle)
	}

	// Series & Volume extraction
	seriesName, volume := ExtractCanonicalSeriesAndVolume(cleanTitle)
	if seriesName == "" {
		seriesName = cleanTitle
	}

	// Release date
	var releaseDate *time.Time
	dateEl := card.Find(".product-item-attribute-release-date small, .product-item-attribute-release-date").First()
	if dateEl.Length() > 0 {
		dTxt := strings.TrimSpace(dateEl.Text())
		for _, layout := range []string{"02/01/06", "02/01/2006"} {
			if parsed, err := time.Parse(layout, dTxt); err == nil {
				releaseDate = &parsed
				break
			}
		}
	}
	if releaseDate == nil {
		now := time.Now()
		releaseDate = &now
	}

	// ISBN from product URL slug or SKU code
	isbn := ""
	if prodURL != "" {
		if m := rePaniniISBN13.FindStringSubmatch(prodURL); len(m) > 1 {
			isbn = m[1]
		}
	}
	if isbn == "" && skuVal != "" {
		if m := rePaniniISBN13.FindStringSubmatch(skuVal); len(m) > 1 {
			isbn = m[1]
		}
	}

	return &ScrapedBook{
		Title:        TruncateString(cleanTitle, 255),
		SeriesName:   TruncateString(seriesName, 255),
		Volume:       volume,
		ISBN:         isbn,
		EditorName:   "Panini Comics",
		CategoryName: "Comics",
		PageCount:    0,
		Price:        price,
		Description:  fmt.Sprintf("Édition Panini Comics: %s", cleanTitle),
		CoverURL:     coverURL,
		ReleaseDate:  releaseDate,
		BookType:     "Comics",
		SourceURL:    prodURL,
		IsVariant:    isVariant,
	}
}

func (s *PaniniComicsScraper) Scrape(
	maxItems int,
	fullScan bool,
	onBookFound func(ScrapedBook),
	isStopped func() bool,
) ([]ScrapedBook, error) {
	if maxItems <= 0 {
		maxItems = 50
	}

	var books []ScrapedBook
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Timeout: getRequestTimeout(),
		Jar:     jar,
	}

	seenTitles := make(map[string]bool)
	seenURLs := make(map[string]bool)

	for _, categoryURL := range PaniniCatalogURLs {
		if isStopped != nil && isStopped() {
			break
		}
		if !fullScan && len(books) >= maxItems {
			break
		}

		currentPageURL := categoryURL
		visitedPages := make(map[string]bool)

		for currentPageURL != "" {
			if isStopped != nil && isStopped() {
				break
			}
			if !fullScan && len(books) >= maxItems {
				break
			}
			if visitedPages[currentPageURL] {
				break
			}

			visitedPages[currentPageURL] = true
			log.Printf("Panini: Fetching listing %s", currentPageURL)

			htmlContent := s.fetchPageHTML(client, currentPageURL)
			if htmlContent == "" {
				log.Printf("Panini: Failed to fetch %s", currentPageURL)
				break
			}

			doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
			if err != nil {
				break
			}

			cards := doc.Find("li.item.product.product-item")
			if cards.Length() == 0 {
				cards = doc.Find("div.product-item-info")
			}

			cards.EachWithBreak(func(_ int, card *goquery.Selection) bool {
				if isStopped != nil && isStopped() {
					return false
				}
				if !fullScan && len(books) >= maxItems {
					return false
				}

				book := s.ParseCard(card, currentPageURL)
				if book == nil {
					return true
				}

				if seenTitles[book.Title] || (book.SourceURL != "" && seenURLs[book.SourceURL]) {
					return true
				}
				seenTitles[book.Title] = true
				if book.SourceURL != "" {
					seenURLs[book.SourceURL] = true
				}

				books = append(books, *book)
				if onBookFound != nil {
					onBookFound(*book)
				}
				return true
			})

			currentPageURL = ExtractPaniniNextPageURL(doc, currentPageURL)
		}
	}

	log.Printf("Panini: Finished scraping, retrieved %d books", len(books))
	return books, nil
}
