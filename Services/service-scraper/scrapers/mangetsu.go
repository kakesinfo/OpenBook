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

var (
	reMangetsuCatLink      = regexp.MustCompile(`/catalogue/978\d+`)
	reMangetsuCatISBN      = regexp.MustCompile(`/catalogue/(978\d{10})`)
	reMangetsuPageParam    = regexp.MustCompile(`[?&]page=(\d+)`)
	reMangetsuPageStrip    = regexp.MustCompile(`[?&]page=\d+`)
	reMangetsuSlugNumStrip = regexp.MustCompile(`^\d+-`)
	reMangetsuISBN         = regexp.MustCompile(`(978[-\s0-9]{10,15})`)
	reMangetsuPages        = regexp.MustCompile(`(?i)Nombre de pages\s*([0-9]+)`)
	reMangetsuParution     = regexp.MustCompile(`(?i)Parution\s*:\s*([^<\n\r]+)`)
	reMangetsuPrice        = regexp.MustCompile(`(\d+)[,.]?(\d+)?`)
	reMangetsuVol          = regexp.MustCompile(`(?i)T(?:ome|\.)?\s*0?(\d+)`)
	reMangetsuVolStrip     = regexp.MustCompile(`(?i)T(?:ome)?\s*0?\d+.*`)
)

type mangetsuCardHint struct {
	DateStr   string
	Title     string
	Tome      string
	AuthorStr string
	CoverURL  string
}

type MangetsuScraper struct{}

func NewMangetsuScraper() *MangetsuScraper {
	return &MangetsuScraper{}
}

func (s *MangetsuScraper) Name() string        { return "mangetsu" }
func (s *MangetsuScraper) DisplayName() string { return "Mangetsu" }
func (s *MangetsuScraper) Description() string {
	return "Mangas seinen, shonen & nouveautés japonaises"
}
func (s *MangetsuScraper) Color() string { return "#f59e0b" }

func (s *MangetsuScraper) Scrape(
	maxItems int,
	fullScan bool,
	onBookFound func(ScrapedBook),
	isStopped func() bool,
) ([]ScrapedBook, error) {
	if maxItems <= 0 {
		maxItems = 50
	}

	var books []ScrapedBook
	baseURL := "https://mangetsu-manga.fr"
	client := newHTTPClient(getRequestTimeout())

	seenLinks := make(map[string]bool)
	var productLinks []string
	cardHints := make(map[string]*mangetsuCardHint)

	listingStartURLs := []string{
		fmt.Sprintf("%s/a-paraitre/", baseURL),
		fmt.Sprintf("%s/catalogue/", baseURL),
	}

	log.Printf("Mangetsu: Starting listing crawl (full_scan=%v, max_items=%d)", fullScan, maxItems)

	for _, startURL := range listingStartURLs {
		if isStopped != nil && isStopped() {
			break
		}
		if !fullScan && len(productLinks) >= maxItems {
			break
		}

		currentURL := startURL
		visitedPages := make(map[string]bool)

		for currentURL != "" && !visitedPages[currentURL] {
			if isStopped != nil && isStopped() {
				break
			}
			if !fullScan && len(productLinks) >= maxItems {
				break
			}

			visitedPages[currentURL] = true
			log.Printf("Mangetsu: Fetching listing page %s", currentURL)

			req, err := http.NewRequest(http.MethodGet, currentURL, nil)
			if err != nil {
				break
			}
			req.Header.Set("User-Agent", getUserAgent())
			req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
			req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8")

			resp, err := client.Do(req)
			if err != nil {
				log.Printf("Mangetsu: error loading listing %s: %v", currentURL, err)
				break
			}
			bodyBytes, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr != nil || resp.StatusCode != 200 {
				log.Printf("Mangetsu: Listing page %s returned status %d", currentURL, resp.StatusCode)
				break
			}

			doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(bodyBytes)))
			if err != nil {
				break
			}

			doc.Find(".book-card").EachWithBreak(func(_ int, card *goquery.Selection) bool {
				href, ok := card.Attr("href")
				if ok && reMangetsuCatLink.MatchString(href) {
					fullURL := resolveURL(baseURL, href)
					if !seenLinks[fullURL] {
						seenLinks[fullURL] = true
						productLinks = append(productLinks, fullURL)
					}

					hint := &mangetsuCardHint{}
					if dEl := card.Find(".book-card__date").First(); dEl.Length() > 0 {
						hint.DateStr = CleanText(strings.TrimSpace(dEl.Text()))
					}
					if tEl := card.Find(".book-card__title").First(); tEl.Length() > 0 {
						hint.Title = CleanText(strings.TrimSpace(tEl.Text()))
					}
					if tmEl := card.Find(".book-card__tome").First(); tmEl.Length() > 0 {
						hint.Tome = CleanText(strings.TrimSpace(tmEl.Text()))
					}
					if aEl := card.Find(".book-card__author").First(); aEl.Length() > 0 {
						hint.AuthorStr = CleanText(strings.TrimSpace(aEl.Text()))
					}
					if imgEl := card.Find(".book-card__img").First(); imgEl.Length() > 0 {
						hint.CoverURL, _ = imgEl.Attr("src")
					}
					cardHints[fullURL] = hint

					if !fullScan && len(productLinks) >= maxItems {
						return false
					}
				}
				return true
			})

			doc.Find("a[href]").EachWithBreak(func(_ int, a *goquery.Selection) bool {
				if !fullScan && len(productLinks) >= maxItems {
					return false
				}
				href, _ := a.Attr("href")
				if reMangetsuCatLink.MatchString(href) {
					fullURL := resolveURL(baseURL, href)
					if !seenLinks[fullURL] {
						seenLinks[fullURL] = true
						productLinks = append(productLinks, fullURL)
						if !fullScan && len(productLinks) >= maxItems {
							return false
						}
					}
				}
				return true
			})

			currentURL = s.ExtractNextPageURL(doc, currentURL, baseURL, visitedPages)
		}
	}

	log.Printf("Mangetsu: Found %d product pages to scrape", len(productLinks))

	for _, prodURL := range productLinks {
		if isStopped != nil && isStopped() {
			break
		}
		hint := cardHints[prodURL]
		book := s.scrapeBookPage(client, prodURL, hint)
		if book != nil {
			books = append(books, *book)
			if onBookFound != nil {
				onBookFound(*book)
			}
		}
	}

	log.Printf("Mangetsu: Finished, scraped %d books", len(books))
	return books, nil
}

func (s *MangetsuScraper) ExtractNextPageURL(
	doc *goquery.Document,
	currentURL string,
	baseURL string,
	visitedPages map[string]bool,
) string {
	pagination := doc.Find("div.pagination").First()
	if pagination.Length() == 0 {
		return ""
	}

	// 1. Primary: search for <a rel="next"> or class 'next' or text 'Next'
	var nextHref string
	pagination.Find("a[href]").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		rel, _ := a.Attr("rel")
		cls, _ := a.Attr("class")
		txt := strings.TrimSpace(a.Text())
		if strings.EqualFold(rel, "next") || strings.Contains(strings.ToLower(cls), "next") || strings.Contains(strings.ToLower(txt), "next") {
			href, _ := a.Attr("href")
			nextHref = strings.TrimSpace(href)
			return false
		}
		return true
	})

	if nextHref != "" {
		nextURL := resolveURL(baseURL, nextHref)
		if !visitedPages[nextURL] {
			return nextURL
		}
	}

	// 2. Fallback: inspect page numbers in div.pagination
	curPage := 1
	if m := reMangetsuPageParam.FindStringSubmatch(currentURL); len(m) > 1 {
		curPage, _ = strconv.Atoi(m[1])
	}
	maxPage := curPage

	pagination.Find("a[href]").Each(func(_ int, a *goquery.Selection) {
		href, _ := a.Attr("href")
		if m := reMangetsuPageParam.FindStringSubmatch(href); len(m) > 1 {
			if p, err := strconv.Atoi(m[1]); err == nil && p > maxPage {
				maxPage = p
			}
		}
	})

	if curPage < maxPage {
		cleanBase := reMangetsuPageStrip.ReplaceAllString(currentURL, "")
		sep := "?"
		if strings.Contains(cleanBase, "?") {
			sep = "&"
		}
		candidate := fmt.Sprintf("%s%spage=%d", cleanBase, sep, curPage+1)
		if !visitedPages[candidate] {
			return candidate
		}
	}

	return ""
}

func (s *MangetsuScraper) scrapeBookPage(
	client *http.Client,
	urlStr string,
	hint *mangetsuCardHint,
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

	pageContent := string(bodyBytes)
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(pageContent))
	if err != nil {
		return nil
	}

	// 1. Title
	title := ""
	if h1 := doc.Find("h1").First(); h1.Length() > 0 {
		title = CleanText(strings.TrimSpace(h1.Text()))
	}
	if title == "" && hint != nil && hint.Title != "" {
		title = hint.Title
	}
	if title == "" {
		parts := strings.Split(strings.Trim(urlStr, "/"), "/")
		slug := parts[len(parts)-1]
		slug = reMangetsuSlugNumStrip.ReplaceAllString(slug, "")
		title = CleanText(TitleCaseWords(strings.ReplaceAll(slug, "-", " ")))
	}

	// 2. ISBN
	isbn := ""
	if m := reMangetsuISBN.FindStringSubmatch(pageContent); len(m) > 1 {
		isbn = reHyphenOrSpace.ReplaceAllString(m[1], "")
	} else if mURL := reMangetsuCatISBN.FindStringSubmatch(urlStr); len(mURL) > 1 {
		isbn = mURL[1]
	}

	// 3. Cover image
	coverURL := ""
	if isbn != "" {
		doc.Find("img").EachWithBreak(func(_ int, img *goquery.Selection) bool {
			if src, ok := img.Attr("src"); ok && strings.Contains(src, isbn) {
				coverURL = src
				return false
			}
			return true
		})
	}
	if coverURL == "" {
		doc.Find("img").EachWithBreak(func(_ int, img *goquery.Selection) bool {
			if src, ok := img.Attr("src"); ok && strings.Contains(src, "/media/cache/") {
				coverURL = src
				return false
			}
			return true
		})
	}
	if coverURL == "" && hint != nil && hint.CoverURL != "" {
		coverURL = hint.CoverURL
	}

	// 4. Pages
	pageCount := 0
	if m := reMangetsuPages.FindStringSubmatch(pageContent); len(m) > 1 {
		pageCount, _ = strconv.Atoi(m[1])
	}

	// 5. Date de parution
	var releaseDate *time.Time
	if m := reMangetsuParution.FindStringSubmatch(pageContent); len(m) > 1 {
		releaseDate = ParseFrenchDate(m[1])
	}
	if releaseDate == nil && hint != nil && hint.DateStr != "" {
		releaseDate = ParseFrenchDate(hint.DateStr)
	}
	if releaseDate == nil {
		now := time.Now()
		releaseDate = &now
	}

	// 6. Description
	description := ""
	descDiv := doc.Find("div[class*='description'], div[class*='resume'], div[class*='synopsis']").First()
	if descDiv.Length() > 0 {
		description = CleanText(strings.TrimSpace(descDiv.Text()))
	}
	if description == "" {
		doc.Find("p").EachWithBreak(func(_ int, p *goquery.Selection) bool {
			t := strings.TrimSpace(p.Text())
			low := strings.ToLower(t)
			if len([]rune(t)) > 80 && !strings.Contains(low, "cookie") && !strings.Contains(low, "contact") && !strings.Contains(low, "newsletter") {
				description = CleanText(t)
				return false
			}
			return true
		})
	}

	// 7. Authors
	var authors []ScrapedAuthor
	authorCards := doc.Find(".author-card__name")
	if authorCards.Length() > 0 {
		authorCards.Each(func(_ int, ac *goquery.Selection) {
			aName := CleanText(strings.TrimSpace(ac.Text()))
			if aName != "" {
				fn, ln := SplitAuthorName(aName)
				if ln != "" || fn != "" {
					authors = append(authors, ScrapedAuthor{Firstname: fn, Lastname: ln, Role: "Writer"})
				}
			}
		})
	}
	if len(authors) == 0 {
		if h2Author := doc.Find("h2.book__author").First(); h2Author.Length() > 0 {
			for _, aName := range strings.Split(strings.TrimSpace(h2Author.Text()), ",") {
				aName = CleanText(aName)
				if aName != "" {
					fn, ln := SplitAuthorName(aName)
					if ln != "" || fn != "" {
						authors = append(authors, ScrapedAuthor{Firstname: fn, Lastname: ln, Role: "Writer"})
					}
				}
			}
		}
	}
	if len(authors) == 0 && hint != nil && hint.AuthorStr != "" {
		for _, aName := range strings.Split(hint.AuthorStr, ",") {
			aName = CleanText(aName)
			if aName != "" {
				fn, ln := SplitAuthorName(aName)
				if ln != "" || fn != "" {
					authors = append(authors, ScrapedAuthor{Firstname: fn, Lastname: ln, Role: "Writer"})
				}
			}
		}
	}

	// 8. Price
	price := 8
	if priceSpan := doc.Find(".price__value").First(); priceSpan.Length() > 0 {
		if m := reMangetsuPrice.FindStringSubmatch(strings.TrimSpace(priceSpan.Text())); len(m) > 1 {
			price, _ = strconv.Atoi(m[1])
		}
	}

	// 9. Series & Volume
	seriesName := title
	var volume *int
	volM := reMangetsuVol.FindStringSubmatch(title)
	if len(volM) == 0 && hint != nil && hint.Tome != "" {
		volM = reMangetsuVol.FindStringSubmatch(hint.Tome)
	}
	if len(volM) > 1 {
		if v, err := strconv.Atoi(volM[1]); err == nil {
			volume = &v
		}
		seriesName = strings.Trim(reMangetsuVolStrip.ReplaceAllString(title, ""), " -:")
	}

	// 10. Collection & Format Qualification
	collectionName := ""
	doc.Find(".book__info").EachWithBreak(func(_ int, info *goquery.Selection) bool {
		lbl := info.Find(".book__info__label").First()
		if lbl.Length() > 0 && strings.Contains(strings.ToLower(lbl.Text()), "collection") {
			rawCol := strings.Replace(info.Text(), lbl.Text(), "", 1)
			collectionName = CleanText(strings.TrimSpace(rawCol))
			return false
		}
		return true
	})

	seriesQualifier := ""
	if (collectionName != "" && strings.Contains(strings.ToLower(collectionName), "junji ito") && len(volM) > 0 && pageCount > 0 && pageCount <= 350 && price <= 10) ||
		strings.Contains(strings.ToLower(title), "poche") ||
		(hint != nil && strings.Contains(strings.ToLower(hint.Tome), "poche")) {
		seriesQualifier = "Poche"
	}

	return &ScrapedBook{
		Title:           TruncateString(title, 255),
		SeriesName:      TruncateString(seriesName, 255),
		SeriesQualifier: seriesQualifier,
		Volume:          volume,
		ISBN:            isbn,
		EditorName:      "Mangetsu",
		CollectionName:  collectionName,
		CategoryName:    "Manga",
		PageCount:       pageCount,
		Price:           price,
		Description:     description,
		CoverURL:        coverURL,
		ReleaseDate:     releaseDate,
		BookType:        "Manga",
		Authors:         authors,
		SourceURL:       urlStr,
	}
}
