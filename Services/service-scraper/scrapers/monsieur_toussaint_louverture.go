package scrapers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

var RomanNums = map[string]int{
	"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
}

var FrenchOrdinals = map[string]int{
	"premier": 1, "premiere": 1, "première": 1,
	"deuxieme": 2, "deuxième": 2, "second": 2, "seconde": 2,
	"troisieme": 3, "troisième": 3,
	"quatrieme": 4, "quatrième": 4,
	"cinquieme": 5, "cinquième": 5,
}

var ObjetKeywords = []string{
	"sérigraphie", "serigraphie", "carnet", "tasse", "t-shirt", "affiche",
	"badge", "marque-page", "miniature", "(vide)", " vide", "tote bag", "ex-libris",
}

var EpubKeywords = []string{
	"/ epub", "epub", "e-book", "ebook", "livre numérique", "livres numériques",
}

var (
	reMTLVol       = regexp.MustCompile(`(?i)[\s–\-]+(?:Volume|Tome|T\.?)\s*0?(\d+)`)
	reMTLFrac      = regexp.MustCompile(`[\s–\-]+.*?(\d+)\s*/\s*\d+`)
	reMTLFracS     = regexp.MustCompile(`^(.*?)(?:[\s–\-]+Rapport|[\s–\-]+\d+\s*/)`)
	reMTLRoman     = regexp.MustCompile(`(?i)\b(Blackwater|Swan Song)\s+([IVX]+)\b`)
	reMTLOrdinal   = regexp.MustCompile(`(?i)[\s–\-]+Livre\s+(premier|premi[eè]re|deuxi[eè]me|second|seconde|troisi[eè]me|quatri[eè]me|\d+)`)
	reMTLEAN       = regexp.MustCompile(`EAN\s*:\s*([0-9]{13})`)
	reMTLISBN      = regexp.MustCompile(`\b(97[89][0-9]{10})\b`)
	reMTLSubStrip  = regexp.MustCompile(`(?i)[\s–\-]+(?:[ée]dition|collection).*`)
	reMTLAuthor    = regexp.MustCompile(`(?i)(?:Écrit et dessiné|Écrit|Roman de|Un roman de)\s+par\s+([^.,\n\r]+)`)
	reMTLPrice     = regexp.MustCompile(`(\d+)(?:[,\.]\d+)?`)
	reMTLPagesSpec = regexp.MustCompile(`(?i)(\d+)\s*pages(?:\s+couleurs?)?\.?\s*(?:Format|\d+\s*x\s*\d+|Couverture|Prix|\.)`)
	reMTLPagesAll  = regexp.MustCompile(`(?i)(\d{2,4})\s*pages`)
	reMTLDate      = regexp.MustCompile(`(?i)Date de (?:parution|publication)\s*[:\s]+\s*([0-9]{1,2}\s+[a-zà-ÿ]+\s+[0-9]{4})`)
	reMTLYear      = regexp.MustCompile(`\b(20[12][0-9])\b`)
)

func ParseMTLSeriesAndVolume(title string) (string, *int) {
	seriesName := title

	// 1. Volume X, Tome X, T X
	if loc := reMTLVol.FindStringSubmatchIndex(title); loc != nil {
		if v, err := strconv.Atoi(title[loc[2]:loc[3]]); err == nil {
			seriesName = strings.Trim(title[:loc[0]], " –-:,")
			return seriesName, &v
		}
	}

	// 2. Fractions (e.g. 1/3, 2/3)
	if m := reMTLFrac.FindStringSubmatch(title); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			if ms := reMTLFracS.FindStringSubmatch(title); len(ms) > 1 {
				seriesName = strings.Trim(ms[1], " –-:,")
			}
			return seriesName, &v
		}
	}

	// 3. Known roman numeral series: 'Blackwater I', 'Swan Song II'
	if m := reMTLRoman.FindStringSubmatch(title); len(m) > 2 {
		seriesName = m[1]
		rom := strings.ToLower(m[2])
		if v, ok := RomanNums[rom]; ok {
			return seriesName, &v
		}
		return seriesName, nil
	}

	// 4. French ordinals: 'Livre premier', 'Livre deuxième'
	if loc := reMTLOrdinal.FindStringSubmatchIndex(title); loc != nil {
		val := strings.ToLower(title[loc[2]:loc[3]])
		var vol *int
		if v, ok := FrenchOrdinals[val]; ok {
			vol = &v
		} else if v, err := strconv.Atoi(val); err == nil {
			vol = &v
		}
		seriesName = strings.Trim(title[:loc[0]], " –-:,")
		return seriesName, vol
	}

	return seriesName, nil
}

type mtlCollectionConfig struct {
	URL        string
	Collection string
	Category   string
}

var mtlCollections = []mtlCollectionConfig{
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/bibliotheque-mccammon/",
		Collection: "Bibliothèque McCammon",
		Category:   "Roman",
	},
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-romans/",
		Collection: "Grands Romans",
		Category:   "Roman",
	},
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/monsieur-toussaint-laventure/",
		Collection: "Monsieur Toussaint Laventure",
		Category:   "Roman",
	},
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/blackwater/",
		Collection: "Bibliothèque McDowell",
		Category:   "Roman",
	},
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/grands-animaux/",
		Collection: "Les Grands Animaux",
		Category:   "Roman",
	},
	{
		URL:        "https://www.monsieurtoussaintlouverture.com/categorie-produit/boutique/romans-graphiques/",
		Collection: "Romans Graphiques",
		Category:   "Roman Graphique",
	},
}

type MonsieurToussaintLouvertureScraper struct{}

func NewMonsieurToussaintLouvertureScraper() *MonsieurToussaintLouvertureScraper {
	return &MonsieurToussaintLouvertureScraper{}
}

func (s *MonsieurToussaintLouvertureScraper) Name() string {
	return "monsieur_toussaint_louverture"
}
func (s *MonsieurToussaintLouvertureScraper) DisplayName() string {
	return "Monsieur Toussaint Louverture"
}
func (s *MonsieurToussaintLouvertureScraper) Description() string {
	return "Romans, littératures de l'imaginaire, aventures et romans graphiques (Blackwater, McCammon, etc.)"
}
func (s *MonsieurToussaintLouvertureScraper) Color() string { return "#d97706" }

func containsAnyKeyword(text string, keywords []string) bool {
	for _, k := range keywords {
		if strings.Contains(text, k) {
			return true
		}
	}
	return false
}

func (s *MonsieurToussaintLouvertureScraper) Scrape(
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
	seenURLs := make(map[string]bool)

	type prodEntry struct {
		URL      string
		Category string
	}
	var productEntries []prodEntry

	log.Printf("MTL: Gathering books from 6 authorized boutique collections (full_scan=%v, max_items=%d)...", fullScan, maxItems)

	for _, colInfo := range mtlCollections {
		if isStopped != nil && isStopped() {
			break
		}
		if !fullScan && len(productEntries) >= maxItems {
			break
		}

		baseCatURL := colInfo.URL
		catDefault := colInfo.Category
		page := 1

		for {
			if isStopped != nil && isStopped() {
				break
			}
			if !fullScan && len(productEntries) >= maxItems {
				break
			}

			pageURL := baseCatURL
			if page > 1 {
				pageURL = fmt.Sprintf("%s/page/%d/", strings.TrimRight(baseCatURL, "/"), page)
			}

			req, err := http.NewRequest(http.MethodGet, pageURL, nil)
			if err != nil {
				break
			}
			req.Header.Set("User-Agent", getUserAgent())
			req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
			req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

			resp, err := client.Do(req)
			if err != nil {
				log.Printf("MTL: Error fetching %s: %v", pageURL, err)
				break
			}
			bodyBytes, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr != nil || resp.StatusCode != 200 {
				break
			}

			doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(bodyBytes)))
			if err != nil {
				break
			}

			productCards := doc.Find(".product")
			if productCards.Length() == 0 {
				break
			}

			foundOnPage := 0
			productCards.EachWithBreak(func(_ int, card *goquery.Selection) bool {
				if isStopped != nil && isStopped() {
					return false
				}

				aTag := card.Find("a[href]").First()
				if aTag.Length() == 0 {
					return true
				}
				href, _ := aTag.Attr("href")
				href = strings.TrimRight(strings.Split(href, "?")[0], "/") + "/"
				if !strings.Contains(href, "/produit/") || seenURLs[href] {
					return true
				}

				cardText := strings.ToLower(strings.TrimSpace(card.Text()))
				if containsAnyKeyword(cardText, ObjetKeywords) || strings.Contains(href, "objets") || strings.Contains(href, "coffret-lheure-du-loup-vide") {
					return true
				}
				if strings.Contains(cardText, "/ epub") || strings.Contains(cardText, "livre numérique") || strings.Contains(cardText, "livres numériques") || strings.Contains(href, "/epub") {
					return true
				}

				seenURLs[href] = true
				productEntries = append(productEntries, prodEntry{
					URL:      href,
					Category: catDefault,
				})
				foundOnPage++

				if !fullScan && len(productEntries) >= maxItems {
					return false
				}
				return true
			})

			hasNext := doc.Find("a[class*='next']").Length() > 0
			if !hasNext || foundOnPage == 0 {
				break
			}
			page++
		}
	}

	log.Printf("MTL: Found %d product URLs to process", len(productEntries))

	for _, entry := range productEntries {
		if isStopped != nil && isStopped() {
			log.Printf("MTL: Stop requested, halting scrape.")
			break
		}

		book := s.scrapeBookPage(client, entry.URL, entry.Category)
		if book != nil {
			books = append(books, *book)
			if onBookFound != nil {
				onBookFound(*book)
			}
			if !fullScan && len(books) >= maxItems {
				log.Printf("MTL: Reached max_items (%d), stopping scan.", maxItems)
				break
			}
		}
	}

	log.Printf("MTL: Finished scrape, collected %d books", len(books))
	return books, nil
}

func (s *MonsieurToussaintLouvertureScraper) scrapeBookPage(
	client *http.Client,
	urlStr string,
	defaultCategory string,
) *ScrapedBook {
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

	rawHTML := string(bodyBytes)
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(rawHTML))
	if err != nil {
		return nil
	}
	pageText := doc.Text()

	// 1. Product Meta check
	meta := doc.Find("div.product_meta").First()
	metaText := ""
	if meta.Length() > 0 {
		metaText = strings.TrimSpace(meta.Text())
	}
	metaLower := strings.ToLower(metaText)

	if strings.Contains(metaLower, "objets") || strings.Contains(metaLower, "livres numériques") || strings.Contains(metaLower, "epub") {
		return nil
	}

	// 2. Title
	h1 := doc.Find("h1.product_title").First()
	if h1.Length() == 0 {
		h1 = doc.Find("h1").First()
	}
	if h1.Length() == 0 {
		return nil
	}

	title := CleanText(strings.TrimSpace(h1.Text()))
	if title == "" || strings.HasPrefix(strings.ToLower(title), "oooops") {
		return nil
	}

	titleLower := strings.ToLower(title)
	if containsAnyKeyword(titleLower, ObjetKeywords) || strings.Contains(titleLower, "/ epub") || strings.Contains(titleLower, "livre numérique") {
		return nil
	}

	// 3. EAN / ISBN
	ean := ""
	if m := reMTLEAN.FindStringSubmatch(metaText); len(m) > 1 {
		ean = m[1]
	} else if mISBN := reMTLISBN.FindStringSubmatch(pageText); len(mISBN) > 1 {
		ean = mISBN[1]
	}
	if ean == "" {
		return nil
	}

	// 4. Author
	var authors []ScrapedAuthor
	authorName := ""
	if sub := doc.Find("div.mtl-product-subtitle").First(); sub.Length() > 0 {
		rawSub := strings.TrimSpace(sub.Text())
		authorStr := strings.TrimSpace(reMTLSubStrip.ReplaceAllString(rawSub, ""))
		lowAuth := strings.ToLower(authorStr)
		if authorStr != "" && !strings.Contains(lowAuth, "toussaint") && !strings.Contains(lowAuth, "livre") && !strings.Contains(lowAuth, "tome") && !strings.Contains(lowAuth, "volume") {
			authorName = authorStr
		}
	}
	if authorName == "" {
		if m := reMTLAuthor.FindStringSubmatch(pageText); len(m) > 1 {
			authorName = strings.TrimSpace(m[1])
		}
	}
	if authorName != "" {
		cleanedAuthor := CleanAuthorName(authorName)
		fn, ln := SplitAuthorName(cleanedAuthor)
		if ln != "" {
			authors = append(authors, ScrapedAuthor{
				Firstname: fn,
				Lastname:  ln,
				Role:      "Writer",
			})
		}
	}

	// 5. Price
	price := 0
	priceTag := doc.Find("div.price-wrapper, p.price").First()
	if priceTag.Length() > 0 {
		if m := reMTLPrice.FindStringSubmatch(priceTag.Text()); len(m) > 1 {
			price, _ = strconv.Atoi(m[1])
		}
	}

	// 6. Page count
	pageCount := 0
	if m := reMTLPagesSpec.FindStringSubmatch(rawHTML); len(m) > 1 {
		pageCount, _ = strconv.Atoi(m[1])
	} else {
		for _, m := range reMTLPagesAll.FindAllStringSubmatch(pageText, -1) {
			if len(m) > 1 {
				if p, err := strconv.Atoi(m[1]); err == nil && p >= 40 {
					pageCount = p
					break
				}
			}
		}
	}

	// 7. Release date
	var releaseDate *time.Time
	if m := reMTLDate.FindStringSubmatch(pageText); len(m) > 1 {
		releaseDate = ParseFrenchDate(strings.TrimSpace(m[1]))
	}
	if releaseDate == nil {
		if mYr := reMTLYear.FindStringSubmatch(pageText); len(mYr) > 1 {
			if yr, err := strconv.Atoi(mYr[1]); err == nil {
				t := time.Date(yr, 1, 1, 0, 0, 0, 0, time.UTC)
				releaseDate = &t
			}
		}
	}
	if releaseDate == nil {
		now := time.Now()
		releaseDate = &now
	}

	// 8. Description
	description := ""
	if shortDesc := doc.Find("div.product-short-description").First(); shortDesc.Length() > 0 {
		t := CleanText(strings.TrimSpace(shortDesc.Text()))
		if len([]rune(t)) > 30 {
			description = t
		}
	}
	if description == "" {
		descPanel := doc.Find("div[class*='woocommerce-Tabs-panel--description']").First()
		if descPanel.Length() > 0 {
			descPanel.Find("p").EachWithBreak(func(_ int, p *goquery.Selection) bool {
				t := CleanText(strings.TrimSpace(p.Text()))
				low := strings.ToLower(t)
				if len([]rune(t)) > 60 && !strings.Contains(low, "cookie") && !strings.Contains(low, "newsletter") && !strings.Contains(low, "harmonia mundi") {
					description = t
					return false
				}
				return true
			})
		}
	}
	if description == "" {
		description = fmt.Sprintf("Ouvrage Monsieur Toussaint Louverture : %s", title)
	}

	// 9. Cover Image URL
	coverURL := ""
	if imgDiv := doc.Find("div.woocommerce-product-gallery__image").First(); imgDiv.Length() > 0 {
		if aImg := imgDiv.Find("a[href]").First(); aImg.Length() > 0 {
			coverURL, _ = aImg.Attr("href")
		} else if imgEl := imgDiv.Find("img").First(); imgEl.Length() > 0 {
			coverURL, _ = imgEl.Attr("src")
		}
	}
	if coverURL == "" {
		if imgTag := doc.Find("img[class*='wp-post-image']").First(); imgTag.Length() > 0 {
			coverURL, _ = imgTag.Attr("src")
		}
	}

	// 10. Series & Volume
	seriesName, volume := ParseMTLSeriesAndVolume(title)
	if seriesName == "" {
		seriesName = title
	}

	// 11. Category & Book Type
	catName := defaultCategory
	bookType := "Roman"
	if strings.Contains(metaLower, "bandes dessinées") || strings.Contains(metaLower, "roman graphique") {
		catName = "Roman Graphique"
		bookType = "Roman Graphique"
	}

	return &ScrapedBook{
		Title:        TruncateString(title, 255),
		SeriesName:   TruncateString(seriesName, 255),
		Volume:       volume,
		ISBN:         ean,
		EditorName:   "Monsieur Toussaint Louverture",
		CategoryName: catName,
		PageCount:    pageCount,
		Price:        price,
		Description:  description,
		CoverURL:     coverURL,
		ReleaseDate:  releaseDate,
		BookType:     bookType,
		Authors:      authors,
		SourceURL:    urlStr,
	}
}
