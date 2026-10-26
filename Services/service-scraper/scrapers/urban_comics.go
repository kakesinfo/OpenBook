package scrapers

import (
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

var AllMonthSlugs = []string{
	"janvier", "fevrier", "mars", "avril", "mai", "juin",
	"juillet", "aout", "septembre", "octobre", "novembre", "decembre",
}

var frenchMonthsMap = map[string]time.Month{
	"janvier":   time.January,
	"janv.":     time.January,
	"janv":      time.January,
	"février":   time.February,
	"fevrier":   time.February,
	"févr.":     time.February,
	"févr":      time.February,
	"fevr.":     time.February,
	"fevr":      time.February,
	"mars":      time.March,
	"avril":     time.April,
	"avr.":      time.April,
	"avr":       time.April,
	"mai":       time.May,
	"juin":      time.June,
	"juillet":   time.July,
	"juil.":     time.July,
	"juil":      time.July,
	"août":      time.August,
	"aout":      time.August,
	"septembre": time.September,
	"sept.":     time.September,
	"sept":      time.September,
	"octobre":   time.October,
	"oct.":      time.October,
	"oct":       time.October,
	"novembre":  time.November,
	"nov.":      time.November,
	"nov":       time.November,
	"décembre":  time.December,
	"decembre":  time.December,
	"déc.":      time.December,
	"déc":       time.December,
	"dec.":      time.December,
	"dec":       time.December,
}

var (
	reFrenchDateDMY = regexp.MustCompile(`(?i)(\d{1,2})\s+([a-zàâäéèêëîïôöùûüç\.]+)\s+(\d{4})`)
	reFrenchDateMY  = regexp.MustCompile(`(?i)([a-zàâäéèêëîïôöùûüç\.]+)\s+(\d{4})`)
	reISODate       = regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
	reSlashDate     = regexp.MustCompile(`(\d{2})/(\d{2})/(\d{4})`)
	reSlugNonAlnum  = regexp.MustCompile(`[^a-z0-9]+`)

	reUrbanSeriePrefix = regexp.MustCompile(`(?i)^S[eé]rie\s*:\s*`)
	reUrbanVolMatch    = regexp.MustCompile(`(?i)\b(?:Tome|Vol(?:ume)?\.?|T)\s*(\d+)\b`)
	reUrbanIntMatch    = regexp.MustCompile(`(?i)Int[eé]grale\s*(\d+)`)
	reUrbanVolStrip    = regexp.MustCompile(`(?i)\b(?:Tome|Vol(?:ume)?\.?|T)\s*\d+.*`)
	reUrbanIntStrip    = regexp.MustCompile(`(?i)Int[eé]grale.*`)
	reUrbanIntegrale   = regexp.MustCompile(`(?i)Int[eé]grale`)

	reDigitsOnly       = regexp.MustCompile(`(\d+)`)
	rePriceDecimal     = regexp.MustCompile(`(\d+)[,\.](\d+)`)
	reUrbanEAN         = regexp.MustCompile(`(?i)<b>(?:EAN|ISBN)\s*:</b>\s*([0-9]{10,13})`)
	reUrbanAlbumEAN    = regexp.MustCompile(`/album/([0-9]{10,13})/`)
	reUrbanPagination  = regexp.MustCompile(`(?i)<b>Pagination\s*:</b>\s*([0-9]+)\s*page`)
	reUrbanPriceHTML   = regexp.MustCompile(`class=["'](?:woocommerce-Price-amount amount|price)["'][^>]*>([0-9]+)[,\.]([0-9]+)`)
	reUrbanRawPrice    = regexp.MustCompile(`Prix\s*:\s*([0-9]+)[,\.]([0-9]+)`)
	reUrbanReleaseDate = regexp.MustCompile(`(?i)<b>Date de sortie\s*:</b>\s*([^<]+)`)
	reUrbanCollection  = regexp.MustCompile(`(?i)<b>Collection\s*:</b>\s*([^<]+)`)
)

func ParseFrenchDate(text string) *time.Time {
	cleaned := strings.ToLower(strings.TrimSpace(text))
	if cleaned == "" {
		return nil
	}

	if m := reISODate.FindStringSubmatch(cleaned); len(m) == 4 {
		y, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		d, _ := strconv.Atoi(m[3])
		if y > 0 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 {
			t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
			return &t
		}
	}

	if m := reSlashDate.FindStringSubmatch(cleaned); len(m) == 4 {
		d, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		y, _ := strconv.Atoi(m[3])
		if y > 0 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 {
			t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
			return &t
		}
	}

	if m := reFrenchDateDMY.FindStringSubmatch(cleaned); len(m) == 4 {
		d, _ := strconv.Atoi(m[1])
		mName := m[2]
		y, _ := strconv.Atoi(m[3])
		if month, ok := frenchMonthsMap[mName]; ok && y > 0 && d >= 1 && d <= 31 {
			t := time.Date(y, month, d, 0, 0, 0, 0, time.UTC)
			return &t
		}
	}

	if m := reFrenchDateMY.FindStringSubmatch(cleaned); len(m) == 3 {
		mName := m[1]
		y, _ := strconv.Atoi(m[2])
		if month, ok := frenchMonthsMap[mName]; ok && y > 0 {
			t := time.Date(y, month, 1, 0, 0, 0, 0, time.UTC)
			return &t
		}
	}

	// Standard formats fallback
	for _, layout := range []string{"2006-01-02", "02/01/2006", "02-01-2006", time.RFC3339} {
		if t, err := time.Parse(layout, cleaned); err == nil {
			return &t
		}
	}

	return nil
}

func SlugTitle(title string) string {
	s := strings.ToLower(title)
	s = reSlugNonAlnum.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func ParseAuthors(doc *goquery.Document) []ScrapedAuthor {
	var authors []ScrapedAuthor
	h5 := doc.Find("h5.authors").First()
	if h5.Length() == 0 {
		return authors
	}

	currentRole := "Writer"
	for _, node := range h5.Nodes {
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			switch child.Type {
			case html.TextNode:
				txt := strings.ToLower(strings.TrimSpace(child.Data))
				if strings.Contains(txt, "scénari") || strings.Contains(txt, "scenar") || strings.Contains(txt, "auteur") || strings.Contains(txt, "histoire") {
					currentRole = "Writer"
				} else if strings.Contains(txt, "dessin") || strings.Contains(txt, "illustrat") || strings.Contains(txt, "artiste") {
					currentRole = "Illustrator"
				} else if strings.Contains(txt, "color") || strings.Contains(txt, "couleur") {
					currentRole = "Colorist"
				} else if strings.Contains(txt, "traduct") {
					currentRole = "Translator"
				} else if strings.Contains(txt, "encre") {
					currentRole = "Inker"
				} else if strings.Contains(txt, "lettr") {
					currentRole = "Letterer"
				}
			case html.ElementNode:
				if child.Data == "a" {
					rawName := CleanText(strings.TrimSpace(goquery.NewDocumentFromNode(child).Text()))
					lowName := strings.ToLower(rawName)
					if rawName == "" || strings.Contains(lowName, "interview") || strings.Contains(lowName, "portfolio") || strings.Contains(lowName, "auteur") || strings.Contains(lowName, "actualité") {
						continue
					}
					parts := strings.Fields(rawName)
					if len(parts) >= 2 {
						fn := CapitalizeWord(parts[0])
						ln := TitleCaseWords(strings.Join(parts[1:], " "))
						authors = append(authors, ScrapedAuthor{
							Firstname: fn,
							Lastname:  ln,
							Role:      currentRole,
						})
					} else if len(parts) == 1 {
						authors = append(authors, ScrapedAuthor{
							Firstname: "",
							Lastname:  TitleCaseWords(parts[0]),
							Role:      currentRole,
						})
					}
				}
			}
		}
	}
	return authors
}

func ParseDescription(doc *goquery.Document) string {
	// 1. Main synopsis block inside div.eightcol before other sections
	eight := doc.Find("div.eightcol").First()
	if eight.Length() > 0 {
		h1 := eight.Find("h1, h2").First()
		var h1Node *html.Node
		if h1.Length() > 0 {
			h1Node = h1.Nodes[0]
		}
		var descParts []string
		start := false
		for child := eight.Nodes[0].FirstChild; child != nil; child = child.NextSibling {
			if h1Node != nil && child == h1Node {
				start = true
				continue
			}
			if start {
				if child.Type == html.ElementNode {
					switch child.Data {
					case "div", "ul", "h5", "h3", "h4", "form", "script":
						goto doneEight
					}
					t := strings.TrimSpace(goquery.NewDocumentFromNode(child).Text())
					if t != "" {
						descParts = append(descParts, t)
					}
				} else if child.Type == html.TextNode {
					t := strings.TrimSpace(child.Data)
					if t != "" {
						descParts = append(descParts, t)
					}
				}
			}
		}
	doneEight:
		fullDesc := strings.TrimSpace(strings.Join(descParts, " "))
		if len(fullDesc) > 30 {
			return CleanText(fullDesc)
		}
	}

	// 2. og:description
	if content, exists := doc.Find(`meta[property="og:description"]`).Attr("content"); exists {
		content = strings.TrimSpace(content)
		if content != "" {
			return CleanText(content)
		}
	}

	// 3. div.entry-content
	descDiv := doc.Find("div.entry-content").First()
	if descDiv.Length() > 0 {
		var descTexts []string
		descDiv.Find("p").Each(func(_ int, p *goquery.Selection) {
			t := strings.TrimSpace(p.Text())
			if t != "" {
				descTexts = append(descTexts, t)
			}
		})
		if len(descTexts) > 0 {
			if len(descTexts) > 3 {
				descTexts = descTexts[:3]
			}
			return CleanText(strings.Join(descTexts, "\n\n"))
		}
	}

	return ""
}

func ParseSeriesAndVolume(title string, doc *goquery.Document) (string, *int) {
	seriesName := ""
	var volume *int

	// 1. Check explicit serie_album container
	if doc != nil {
		serieDiv := doc.Find("div.serie_album").First()
		if serieDiv.Length() > 0 {
			aSerie := serieDiv.Find("a").First()
			if aSerie.Length() > 0 && strings.TrimSpace(aSerie.Text()) != "" {
				seriesName = strings.TrimSpace(aSerie.Text())
			} else {
				txt := strings.TrimSpace(serieDiv.Text())
				seriesName = strings.TrimSpace(reUrbanSeriePrefix.ReplaceAllString(txt, ""))
			}
		}
	}

	// 2. Extract volume number
	volMatch := reUrbanVolMatch.FindStringSubmatch(title)
	if len(volMatch) > 1 {
		if v, err := strconv.Atoi(volMatch[1]); err == nil {
			volume = &v
		}
	} else if intMatch := reUrbanIntMatch.FindStringSubmatch(title); len(intMatch) > 1 {
		if v, err := strconv.Atoi(intMatch[1]); err == nil {
			volume = &v
		}
	}

	// 3. If series_name not extracted from page container, derive from title
	if seriesName == "" {
		if len(volMatch) > 1 {
			seriesName = strings.Trim(reUrbanVolStrip.ReplaceAllString(title, ""), " -:")
		} else if reUrbanIntegrale.MatchString(title) {
			seriesName = strings.Trim(reUrbanIntStrip.ReplaceAllString(title, ""), " -:")
		} else {
			seriesName = title
		}
	}

	if seriesName == "" {
		seriesName = title
	}

	return CleanText(seriesName), volume
}

type urbanTargetHint struct {
	Title       string
	CoverURL    string
	Price       int
	ReleaseDate *time.Time
	ISBN        string
}

type UrbanComicsScraper struct{}

func NewUrbanComicsScraper() *UrbanComicsScraper {
	return &UrbanComicsScraper{}
}

func (s *UrbanComicsScraper) Name() string        { return "urban_comics" }
func (s *UrbanComicsScraper) DisplayName() string { return "Urban Comics" }
func (s *UrbanComicsScraper) Description() string { return "Comics DC, Indies, Urban Link" }
func (s *UrbanComicsScraper) Color() string       { return "#3b82f6" }

func (s *UrbanComicsScraper) doGet(client *http.Client, urlStr string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, urlStr, nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("User-Agent", getUserAgent())
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return resp.StatusCode, body, err
}

func (s *UrbanComicsScraper) Scrape(
	maxItems int,
	fullScan bool,
	onBookFound func(ScrapedBook),
	isStopped func() bool,
) ([]ScrapedBook, error) {
	if maxItems <= 0 {
		maxItems = 50
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 6,
			IdleConnTimeout:     30 * time.Second,
		},
	}

	targets := make(map[string]*urbanTargetHint)
	var targetOrder []string
	mergeTarget := func(link string, info *urbanTargetHint) {
		if existing, ok := targets[link]; !ok {
			targets[link] = info
			targetOrder = append(targetOrder, link)
		} else {
			if existing.Title == "" && info.Title != "" {
				existing.Title = info.Title
			}
			if existing.CoverURL == "" && info.CoverURL != "" {
				existing.CoverURL = info.CoverURL
			}
			if existing.Price == 0 && info.Price != 0 {
				existing.Price = info.Price
			}
			if existing.ReleaseDate == nil && info.ReleaseDate != nil {
				existing.ReleaseDate = info.ReleaseDate
			}
			if existing.ISBN == "" && info.ISBN != "" {
				existing.ISBN = info.ISBN
			}
		}
	}

	log.Printf("UrbanComics: Starting crawl (full_scan=%v, max_items=%d)...", fullScan, maxItems)

	// 1. Scrape À paraître
	apTargets, apOrder := s.crawlAParaitre(client, fullScan, isStopped)
	log.Printf("UrbanComics: Found %d items from à paraître", len(apTargets))
	for _, link := range apOrder {
		mergeTarget(link, apTargets[link])
	}

	if isStopped != nil && isStopped() {
		return nil, nil
	}

	// 2. Scrape Shop
	shopTargets, shopOrder := s.crawlShop(client, fullScan, isStopped)
	log.Printf("UrbanComics: Found %d items from shop catalogue", len(shopTargets))
	for _, link := range shopOrder {
		mergeTarget(link, shopTargets[link])
	}

	if isStopped != nil && isStopped() {
		return nil, nil
	}

	// 3. Sitemaps discovery
	if fullScan || len(targets) < maxItems {
		smTargets, smOrder := s.crawlSitemaps(client, fullScan, isStopped)
		log.Printf("UrbanComics: Found %d items from sitemaps", len(smTargets))
		for _, link := range smOrder {
			mergeTarget(link, smTargets[link])
		}
	}

	if isStopped != nil && isStopped() {
		return nil, nil
	}

	totalDiscovered := len(targets)
	log.Printf("UrbanComics: Total unique titles discovered: %d", totalDiscovered)

	if totalDiscovered == 0 {
		if isStopped != nil && isStopped() {
			return nil, nil
		}
		return nil, fmt.Errorf("Impossible de joindre www.urban-comics.com : le serveur web de l'éditeur est actuellement hors ligne ou inaccessible (connexion refusée / code 521).")
	}

	type targetPair struct {
		url   string
		hints *urbanTargetHint
	}

	var targetList []targetPair
	if !fullScan {
		var apItems, otherItems []targetPair
		for _, link := range targetOrder {
			h := targets[link]
			if h.ReleaseDate != nil {
				apItems = append(apItems, targetPair{link, h})
			} else {
				otherItems = append(otherItems, targetPair{link, h})
			}
		}
		remainingSlots := maxItems - len(apItems)
		if remainingSlots < 0 {
			remainingSlots = 0
		}
		if remainingSlots > len(otherItems) {
			remainingSlots = len(otherItems)
		}
		targetList = append(apItems, otherItems[:remainingSlots]...)
	} else {
		for _, link := range targetOrder {
			targetList = append(targetList, targetPair{link, targets[link]})
		}
	}

	// 4. Concurrently fetch and parse product pages with gentle concurrency
	maxWorkers := 4
	log.Printf("UrbanComics: Fetching %d detail pages using %d threads...", len(targetList), maxWorkers)

	var (
		books   []ScrapedBook
		booksMu sync.Mutex
		wg      sync.WaitGroup
		ch      = make(chan targetPair, len(targetList))
	)

	for _, tp := range targetList {
		ch <- tp
	}
	close(ch)

	pageClient := &http.Client{
		Timeout: 12 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 6,
			IdleConnTimeout:     30 * time.Second,
		},
	}

	for w := 0; w < maxWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for tp := range ch {
				if isStopped != nil && isStopped() {
					return
				}
				book := s.scrapeProductPage(pageClient, tp.url, tp.hints)
				if book != nil {
					if isStopped != nil && isStopped() {
						return
					}
					booksMu.Lock()
					books = append(books, *book)
					booksMu.Unlock()
					if onBookFound != nil {
						onBookFound(*book)
					}
				}
			}
		}()
	}

	wg.Wait()
	log.Printf("UrbanComics: Completed scrape. Extracted %d books.", len(books))
	return books, nil
}

func (s *UrbanComicsScraper) crawlAParaitre(
	client *http.Client,
	fullScan bool,
	isStopped func() bool,
) (map[string]*urbanTargetHint, []string) {
	targets := make(map[string]*urbanTargetHint)
	var order []string

	baseAPURL := "https://www.urban-comics.com/a-paraitre/"
	log.Printf("UrbanComics: Fetching base à paraître page: %s", baseAPURL)
	if status, body, err := s.doGet(client, baseAPURL); err == nil && status == 200 {
		if doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body))); err == nil {
			s.extractComicsContainers(doc, targets, &order)
		}
	}

	if isStopped != nil && isStopped() {
		return targets, order
	}

	now := time.Now()
	currentYear := now.Year()
	currentMonth := int(now.Month())

	type monthYear struct {
		month string
		year  int
	}
	var monthsToVisit []monthYear

	if fullScan {
		for y := 2012; y <= currentYear+1; y++ {
			for _, m := range AllMonthSlugs {
				monthsToVisit = append(monthsToVisit, monthYear{m, y})
			}
		}
	} else {
		for offset := -3; offset < 10; offset++ {
			val := currentMonth - 1 + offset
			targetMonthIdx := ((val % 12) + 12) % 12
			yearOffset := 0
			if val < 0 {
				yearOffset = (val - 11) / 12
			} else {
				yearOffset = val / 12
			}
			targetYear := currentYear + yearOffset
			monthsToVisit = append(monthsToVisit, monthYear{AllMonthSlugs[targetMonthIdx], targetYear})
		}
	}

	log.Printf("UrbanComics: Fetching %d monthly schedule pages...", len(monthsToVisit))

	workers := 6
	if fullScan {
		workers = 4
	}

	monthClient := &http.Client{Timeout: 12 * time.Second}
	results := make([]string, len(monthsToVisit))
	var wg sync.WaitGroup
	idxCh := make(chan int, len(monthsToVisit))
	for i := range monthsToVisit {
		idxCh <- i
	}
	close(idxCh)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range idxCh {
				if isStopped != nil && isStopped() {
					return
				}
				my := monthsToVisit[idx]
				u := fmt.Sprintf("https://www.urban-comics.com/a-paraitre/%s/%d/", my.month, my.year)
				if status, body, err := s.doGet(monthClient, u); err == nil && status == 200 {
					results[idx] = string(body)
					continue
				}
				uChk := fmt.Sprintf("https://www.urban-comics.com/checklist/%s/%d/", my.month, my.year)
				if status, body, err := s.doGet(monthClient, uChk); err == nil && status == 200 {
					results[idx] = string(body)
				}
			}
		}()
	}
	wg.Wait()

	for _, pageHTML := range results {
		if pageHTML != "" {
			if doc, err := goquery.NewDocumentFromReader(strings.NewReader(pageHTML)); err == nil {
				s.extractComicsContainers(doc, targets, &order)
			}
		}
	}

	return targets, order
}

func (s *UrbanComicsScraper) extractComicsContainers(
	doc *goquery.Document,
	targets map[string]*urbanTargetHint,
	order *[]string,
) {
	doc.Find("div.comics-container").Each(func(_ int, container *goquery.Selection) {
		aTag := container.Find("a[href]").First()
		if aTag.Length() == 0 {
			return
		}
		href, _ := aTag.Attr("href")
		urlStr := strings.TrimRight(strings.Split(href, "?")[0], "/") + "/"
		if !strings.Contains(urlStr, "urban-comics.com") {
			return
		}
		for _, skip := range []string{"/a-paraitre", "/checklist", "/shop", "/category", "/auteurs"} {
			if strings.Contains(urlStr, skip) {
				return
			}
		}

		var relDate *time.Time
		header := container.Find("div.comics-container-header").First()
		if header.Length() > 0 {
			relDate = ParseFrenchDate(strings.TrimSpace(header.Text()))
		}

		coverURL := ""
		img := container.Find("img").First()
		if img.Length() > 0 {
			if src, ok := img.Attr("src"); ok && src != "" {
				coverURL = src
			} else if lazySrc, ok := img.Attr("data-lazy-src"); ok && lazySrc != "" {
				coverURL = lazySrc
			}
		}

		captionTitle := ""
		captionPrice := 0
		caption := container.Find("div.caption").First()
		if caption.Length() > 0 {
			h3 := caption.Find("h3, h5").First()
			if h3.Length() > 0 {
				captionTitle = CleanText(strings.TrimSpace(h3.Text()))
			}
			priceB := caption.Find("div.caption-prix").First()
			if priceB.Length() > 0 {
				if m := reDigitsOnly.FindStringSubmatch(strings.TrimSpace(priceB.Text())); len(m) > 1 {
					captionPrice, _ = strconv.Atoi(m[1])
				}
			}
		}

		hint, exists := targets[urlStr]
		if !exists {
			hint = &urbanTargetHint{}
			targets[urlStr] = hint
			*order = append(*order, urlStr)
		}
		if relDate != nil && hint.ReleaseDate == nil {
			hint.ReleaseDate = relDate
		}
		if coverURL != "" && hint.CoverURL == "" {
			hint.CoverURL = coverURL
		}
		if captionTitle != "" && hint.Title == "" {
			hint.Title = captionTitle
		}
		if captionPrice != 0 && hint.Price == 0 {
			hint.Price = captionPrice
		}
	})
}

func (s *UrbanComicsScraper) crawlShop(
	client *http.Client,
	fullScan bool,
	isStopped func() bool,
) (map[string]*urbanTargetHint, []string) {
	targets := make(map[string]*urbanTargetHint)
	var order []string
	maxPages := 1
	if fullScan {
		maxPages = 200
	}

	for page := 1; page <= maxPages; page++ {
		if isStopped != nil && isStopped() {
			break
		}
		urlStr := "https://www.urban-comics.com/shop/"
		if page > 1 {
			urlStr = fmt.Sprintf("https://www.urban-comics.com/shop/page/%d/", page)
		}
		status, body, err := s.doGet(client, urlStr)
		if err != nil || status != 200 {
			break
		}
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
		if err != nil {
			break
		}
		foundCount := s.extractShopCards(doc, targets, &order)
		if foundCount == 0 || !fullScan {
			break
		}
	}

	return targets, order
}

func (s *UrbanComicsScraper) extractShopCards(
	doc *goquery.Document,
	targets map[string]*urbanTargetHint,
	order *[]string,
) int {
	count := 0
	doc.Find("li.product, div.product, article.product").Each(func(_ int, tag *goquery.Selection) {
		a := tag.Find("a[href]").First()
		if a.Length() == 0 {
			return
		}
		href, _ := a.Attr("href")
		cleanHref := strings.TrimRight(strings.Split(href, "?")[0], "/") + "/"
		if !strings.Contains(cleanHref, "urban-comics.com") {
			return
		}
		for _, skip := range []string{"/shop", "/category", "/auteurs", "/tag", "/collection"} {
			if strings.Contains(cleanHref, skip) {
				return
			}
		}

		title := ""
		titleElem := tag.Find(".woocommerce-loop-product__title, .product-title, .title, h2, h3").First()
		if titleElem.Length() > 0 {
			title = CleanText(strings.TrimSpace(titleElem.Text()))
		}

		coverURL := ""
		img := tag.Find("img").First()
		if img.Length() > 0 {
			for _, attr := range []string{"src", "data-lazy-src", "data-src"} {
				if val, ok := img.Attr(attr); ok && val != "" {
					coverURL = val
					break
				}
			}
		}

		price := 0
		priceElem := tag.Find(".price, .amount").First()
		if priceElem.Length() > 0 {
			if m := rePriceDecimal.FindStringSubmatch(strings.TrimSpace(priceElem.Text())); len(m) > 1 {
				price, _ = strconv.Atoi(m[1])
			}
		}

		hint, exists := targets[cleanHref]
		if !exists {
			hint = &urbanTargetHint{}
			targets[cleanHref] = hint
			*order = append(*order, cleanHref)
		}
		if title != "" && hint.Title == "" {
			hint.Title = title
		}
		if coverURL != "" && hint.CoverURL == "" {
			hint.CoverURL = coverURL
		}
		if price != 0 && hint.Price == 0 {
			hint.Price = price
		}
		count++
	})
	return count
}

type sitemapIndexXML struct {
	Sitemaps []struct {
		Loc string `xml:"loc"`
	} `xml:"sitemap"`
}

type urlsetXML struct {
	URLs []struct {
		Loc     string `xml:"loc"`
		LastMod string `xml:"lastmod"`
		Images  []struct {
			Loc   string `xml:"loc"`
			Title string `xml:"title"`
		} `xml:"image"`
	} `xml:"url"`
}

func (s *UrbanComicsScraper) crawlSitemaps(
	client *http.Client,
	fullScan bool,
	isStopped func() bool,
) (map[string]*urbanTargetHint, []string) {
	targets := make(map[string]*urbanTargetHint)
	var order []string
	var sitemapsToCrawl []string
	seenSM := make(map[string]bool)

	for _, idxURL := range []string{"https://www.urban-comics.com/sitemap_index.xml", "https://www.urban-comics.com/wp-sitemap.xml"} {
		if isStopped != nil && isStopped() {
			break
		}
		status, body, err := s.doGet(client, idxURL)
		if err == nil && status == 200 {
			var idx sitemapIndexXML
			if xml.Unmarshal(body, &idx) == nil {
				for _, sm := range idx.Sitemaps {
					locText := strings.TrimSpace(sm.Loc)
					if locText == "" {
						continue
					}
					if strings.Contains(locText, "product") || strings.Contains(locText, "album") || strings.Contains(locText, "post") || strings.Contains(locText, "comic") {
						if !strings.Contains(locText, "category") && !strings.Contains(locText, "tag") && !strings.Contains(locText, "author") && !strings.Contains(locText, "collection") {
							if !seenSM[locText] {
								seenSM[locText] = true
								sitemapsToCrawl = append(sitemapsToCrawl, locText)
							}
						}
					}
				}
				if len(sitemapsToCrawl) > 0 {
					break
				}
			}
		}
	}

	if len(sitemapsToCrawl) == 0 {
		sitemapsToCrawl = []string{
			"https://www.urban-comics.com/product-sitemap3.xml",
			"https://www.urban-comics.com/product-sitemap2.xml",
			"https://www.urban-comics.com/product-sitemap1.xml",
			"https://www.urban-comics.com/product-sitemap.xml",
			"https://www.urban-comics.com/product-sitemap4.xml",
			"https://www.urban-comics.com/product-sitemap5.xml",
			"https://www.urban-comics.com/post-sitemap1.xml",
			"https://www.urban-comics.com/post-sitemap2.xml",
			"https://www.urban-comics.com/post-sitemap3.xml",
		}
	}

	if !fullScan {
		var filtered []string
		for _, sm := range sitemapsToCrawl {
			if strings.Contains(sm, "sitemap3") || strings.Contains(sm, "sitemap2") {
				filtered = append(filtered, sm)
				if len(filtered) >= 2 {
					break
				}
			}
		}
		if len(filtered) == 0 {
			filtered = []string{"https://www.urban-comics.com/product-sitemap3.xml"}
		}
		sitemapsToCrawl = filtered
	}

	log.Printf("UrbanComics: Crawling %d XML sitemaps...", len(sitemapsToCrawl))

	for _, smURL := range sitemapsToCrawl {
		if isStopped != nil && isStopped() {
			break
		}
		status, body, err := s.doGet(client, smURL)
		if err != nil || status != 200 {
			continue
		}
		var us urlsetXML
		if err := xml.Unmarshal(body, &us); err != nil {
			continue
		}
		for _, u := range us.URLs {
			loc := strings.TrimSpace(u.Loc)
			if loc == "" {
				continue
			}
			cleanURL := strings.TrimRight(strings.Split(loc, "?")[0], "/") + "/"
			if !strings.Contains(cleanURL, "urban-comics.com") {
				continue
			}
			skipIt := false
			for _, skip := range []string{"/shop", "/category", "/auteurs", "/tag", "/collection", "/a-paraitre", "/checklist"} {
				if strings.Contains(cleanURL, skip) {
					skipIt = true
					break
				}
			}
			if skipIt {
				continue
			}

			hint, exists := targets[cleanURL]
			if !exists {
				hint = &urbanTargetHint{}
				targets[cleanURL] = hint
				order = append(order, cleanURL)
			}
			if len(u.Images) > 0 {
				imgTitle := strings.TrimSpace(u.Images[0].Title)
				imgURL := strings.TrimSpace(u.Images[0].Loc)
				if imgTitle != "" && hint.Title == "" {
					hint.Title = imgTitle
				}
				if imgURL != "" && hint.CoverURL == "" {
					hint.CoverURL = imgURL
				}
			}
			if u.LastMod != "" && hint.ReleaseDate == nil {
				lm := strings.TrimSpace(u.LastMod)
				if len(lm) >= 10 {
					lm = lm[:10]
				}
				if parsedLM := ParseFrenchDate(lm); parsedLM != nil {
					hint.ReleaseDate = parsedLM
				}
			}
		}
	}

	return targets, order
}

func (s *UrbanComicsScraper) scrapeProductPage(
	client *http.Client,
	urlStr string,
	hints *urbanTargetHint,
) *ScrapedBook {
	if hints == nil {
		hints = &urbanTargetHint{}
	}

	status, body, err := s.doGet(client, urlStr)
	if err != nil || status != 200 {
		parts := strings.Split(strings.Trim(urlStr, "/"), "/")
		slug := ""
		if len(parts) > 0 {
			slug = parts[len(parts)-1]
		}
		for _, skip := range []string{"shop", "category", "auteurs", "tag", "collection", "cart", "mon-compte"} {
			if strings.Contains(slug, skip) {
				return nil
			}
		}
		fallbackTitle := hints.Title
		if fallbackTitle == "" {
			fallbackTitle = TitleCaseWords(strings.ReplaceAll(slug, "-", " "))
		}
		if len([]rune(fallbackTitle)) < 2 {
			return nil
		}
		seriesName, volume := ParseSeriesAndVolume(fallbackTitle, nil)
		if volume == nil {
			v := 1
			volume = &v
		}
		relDate := hints.ReleaseDate
		if relDate == nil {
			now := time.Now()
			relDate = &now
		}
		return &ScrapedBook{
			Title:        TruncateString(CleanText(fallbackTitle), 255),
			SeriesName:   TruncateString(CleanText(seriesName), 255),
			Volume:       volume,
			ISBN:         hints.ISBN,
			EditorName:   "Urban Comics",
			CategoryName: "Comics",
			PageCount:    0,
			Price:        hints.Price,
			Description:  "",
			CoverURL:     hints.CoverURL,
			ReleaseDate:  relDate,
			BookType:     "Comics",
			Authors:      nil,
			SourceURL:    urlStr,
		}
	}

	pageContent := string(body)
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(pageContent))
	if err != nil {
		return nil
	}

	// 1. Title
	title := ""
	h1 := doc.Find("#titre-album, h1.product_title, h1.entry-title, h1").First()
	if h1.Length() > 0 {
		title = strings.TrimSpace(h1.Text())
	}
	if title == "" {
		if ogTitle, ok := doc.Find(`meta[property="og:title"]`).Attr("content"); ok && ogTitle != "" {
			title = strings.TrimSpace(strings.Split(ogTitle, " - Urban Comics")[0])
		}
	}
	if title == "" {
		title = hints.Title
	}
	if title == "" {
		parts := strings.Split(strings.Trim(urlStr, "/"), "/")
		slug := ""
		if len(parts) > 0 {
			slug = parts[len(parts)-1]
		}
		for _, skip := range []string{"shop", "category", "auteurs", "tag", "collection"} {
			if strings.Contains(slug, skip) {
				return nil
			}
		}
		title = TitleCaseWords(strings.ReplaceAll(slug, "-", " "))
	}

	title = CleanText(title)

	// 2. Series & Volume
	seriesName, volume := ParseSeriesAndVolume(title, doc)

	// 3. Metadata
	isbn := hints.ISBN
	pageCount := 0
	price := hints.Price
	releaseDate := hints.ReleaseDate

	if m := reUrbanEAN.FindStringSubmatch(pageContent); len(m) > 1 {
		isbn = m[1]
	} else if isbn == "" {
		if dataEAN, ok := doc.Find("[data-ean]").First().Attr("data-ean"); ok && dataEAN != "" {
			isbn = dataEAN
		} else if mImg := reUrbanAlbumEAN.FindStringSubmatch(pageContent); len(mImg) > 1 {
			isbn = mImg[1]
		}
	}

	if m := reUrbanPagination.FindStringSubmatch(pageContent); len(m) > 1 {
		pageCount, _ = strconv.Atoi(m[1])
	}

	if m := reUrbanPriceHTML.FindStringSubmatch(pageContent); len(m) > 1 {
		price, _ = strconv.Atoi(m[1])
	} else if price == 0 {
		if mRaw := reUrbanRawPrice.FindStringSubmatch(pageContent); len(mRaw) > 1 {
			price, _ = strconv.Atoi(mRaw[1])
		}
	}

	if m := reUrbanReleaseDate.FindStringSubmatch(pageContent); len(m) > 1 {
		if parsedD := ParseFrenchDate(m[1]); parsedD != nil {
			releaseDate = parsedD
		}
	}
	if releaseDate == nil {
		now := time.Now()
		releaseDate = &now
	}

	// 4. Cover URL
	coverURL := hints.CoverURL
	if src, ok := doc.Find("img.single-product-cover, img[class*='single-product-cover']").First().Attr("src"); ok && src != "" {
		coverURL = src
	} else if coverURL == "" {
		if ogImg, ok := doc.Find(`meta[property="og:image"]`).Attr("content"); ok && ogImg != "" {
			coverURL = ogImg
		} else if isbn != "" {
			coverURL = fmt.Sprintf("https://bdi.dlpdomain.com/album/%s/couv/M385x862/%s.jpg", isbn, SlugTitle(title))
		}
	}

	// 5. Description
	description := ParseDescription(doc)

	// 6. Authors
	authors := ParseAuthors(doc)

	// 7. Collection
	collectionName := ""
	if m := reUrbanCollection.FindStringSubmatch(pageContent); len(m) > 1 {
		collectionName = CleanText(m[1])
	}

	return &ScrapedBook{
		Title:          TruncateString(title, 255),
		SeriesName:     TruncateString(seriesName, 255),
		Volume:         volume,
		ISBN:           isbn,
		EditorName:     "Urban Comics",
		CollectionName: collectionName,
		CategoryName:   "Comics",
		PageCount:      pageCount,
		Price:          price,
		Description:    description,
		CoverURL:       coverURL,
		ReleaseDate:    releaseDate,
		BookType:       "Comics",
		Authors:        authors,
		SourceURL:      urlStr,
	}
}
