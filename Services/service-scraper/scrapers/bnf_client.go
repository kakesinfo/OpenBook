package scrapers

import (
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	BnfSRUBaseURL = "https://catalogue.bnf.fr/api/SRU"
	BnfUserAgent  = "YetAnotherLibrary/1.0 (https://github.com/yet-another-library)"
)

var (
	reBnfPubCleanup     = regexp.MustCompile(`(?i)\b(?:comics|éditions|editions|manga|bd|publishing|presse)\b`)
	reBnfCQLChars       = regexp.MustCompile(`["\(\)\{\}\[\]:\-<>=\/\\]`)
	reBnfCreatorRoles   = regexp.MustCompile(`(?i)[\.\s]*(?:\((?:auteur|illustrateur|coloriste|traducteur|directeur)[^\)]*\)|\b(?:auteur|illustrateur|coloriste|traducteur)(?:\s+du\s+texte)?\b)[\.\s]*`)
	reBnfCreatorDates   = regexp.MustCompile(`\(\s*[\d\.]{2,4}\s*-[^\)]*\)`)
	reBnfCreatorFunc    = regexp.MustCompile(`(?i)[\.\s]*\b(?:fonction\s+indéterminée|collaborateur\s+au\s+texte|préfacier|directeur\s+de\s+publication)\b.*`)
	reBnfCreatorFirst   = regexp.MustCompile(`(?i)[\.\s]*\b(?:fonction\s+indéterminée|collaborateur\s+au\s+texte)\b.*`)
	reBnfPageCount      = regexp.MustCompile(`(?i)\[?(?:ca\s*)?(\d{2,4})\]?\s*p(?:ages?)?\.?\b`)
	reBnfCollection     = regexp.MustCompile(`(?i)Collection\s*:\s*([^;,\n]+)`)
	reBnfYear           = regexp.MustCompile(`\b(19\d{2}|20\d{2})\b`)
	reBnfFullDate       = regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
	reBnfVolume         = regexp.MustCompile(`(?i)(?:[\.\s,]+0?(\d+)|t(?:ome)?\s*0?(\d+)|vol(?:ume)?\s*0?(\d+)|n°\s*0?(\d+)|\[(\d+)\])`)
	reBnfISBNIdentifier = regexp.MustCompile(`(?:ISBN|EAN)\s*([0-9Xx\-]{10,17})`)
	ReBnfNonISBN        = regexp.MustCompile(`[^0-9Xx]`)
	reBnfVariantExtra   = regexp.MustCompile(`(?i)\b(?:collector|éd(?:ition)?\.?\s*collector|variante?|prestige)\b`)
)

type BnfBookData struct {
	ISBN           string
	Title          string
	Volume         *int
	IsVariant      bool
	PageCount      *int
	CollectionName string
	ReleaseDate    *time.Time
	Authors        []ScrapedAuthor
	Ark            string
}

func CleanPublisherForCQL(editorName string) string {
	ed := strings.TrimSpace(editorName)
	if ed == "" {
		return ""
	}
	low := strings.ToLower(ed)
	switch {
	case strings.Contains(low, "panini"):
		return "Panini"
	case strings.Contains(low, "urban"):
		return "Urban"
	case strings.Contains(low, "mangetsu"):
		return "Mangetsu"
	case strings.Contains(low, "morgen"):
		return "Morgen"
	case strings.Contains(low, "label") || strings.Contains(low, "619"):
		return "619"
	case strings.Contains(low, "toussaint") || strings.Contains(low, "louverture"):
		return "Toussaint"
	}
	ed = strings.Trim(reBnfPubCleanup.ReplaceAllString(ed, ""), " -:")
	return ed
}

func CleanTitleForCQL(text string) string {
	cleaned := CleanText(text)
	cleaned = reBnfCQLChars.ReplaceAllString(cleaned, " ")
	return strings.Join(strings.Fields(cleaned), " ")
}

func ParseBnfCreator(raw string) (string, string, string) {
	rawClean := CleanText(raw)
	role := "Writer"
	lower := strings.ToLower(rawClean)
	if strings.Contains(lower, "illustrat") || strings.Contains(lower, "dessin") {
		role = "Illustrator"
	} else if strings.Contains(lower, "coloris") {
		role = "Colorist"
	} else if strings.Contains(lower, "traduct") {
		role = "Translator"
	}

	cleaned := reBnfCreatorRoles.ReplaceAllString(rawClean, "")
	cleaned = reBnfCreatorDates.ReplaceAllString(cleaned, "")
	cleaned = reBnfCreatorFunc.ReplaceAllString(cleaned, "")
	cleaned = strings.Trim(cleaned, " .,;:-")

	var first, last string
	parts := strings.SplitN(cleaned, ",", 2)
	if len(parts) == 2 {
		last = strings.TrimSpace(parts[0])
		first = strings.TrimSpace(parts[1])
	} else {
		first = ""
		last = strings.TrimSpace(cleaned)
	}

	first = reBnfCreatorDates.ReplaceAllString(first, "")
	first = reBnfCreatorFirst.ReplaceAllString(first, "")
	first = strings.Trim(first, " .,;:-")
	last = strings.Trim(last, " .,;:-")

	return first, last, role
}

func ParseBnfPageCount(formatStr string) *int {
	if formatStr == "" {
		return nil
	}
	if m := reBnfPageCount.FindStringSubmatch(formatStr); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			return &v
		}
	}
	return nil
}

func ParseBnfCollection(descStr string) string {
	if descStr == "" {
		return ""
	}
	m := reBnfCollection.FindStringSubmatch(descStr)
	if len(m) < 2 {
		return ""
	}
	col := strings.Trim(CleanText(m[1]), " .")
	if strings.Contains(col, ".") {
		var parts []string
		for _, p := range strings.Split(col, ".") {
			p = strings.TrimSpace(p)
			if p != "" {
				parts = append(parts, p)
			}
		}
		if len(parts) > 1 {
			col = parts[len(parts)-1]
		}
	}
	return col
}

func ParseBnfDate(dateStr string) *time.Time {
	cleaned := strings.TrimSpace(dateStr)
	if cleaned == "" {
		return nil
	}
	if m := reBnfYear.FindStringSubmatch(cleaned); len(m) > 1 {
		year, _ := strconv.Atoi(m[1])
		if mFull := reBnfFullDate.FindStringSubmatch(cleaned); len(mFull) == 4 {
			y, _ := strconv.Atoi(mFull[1])
			mo, _ := strconv.Atoi(mFull[2])
			d, _ := strconv.Atoi(mFull[3])
			if y > 0 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 {
				t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
				return &t
			}
		}
		t := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		return &t
	}
	return nil
}

func ExtractBnfVolume(title string) *int {
	m := reBnfVolume.FindStringSubmatch(title)
	if len(m) > 1 {
		for _, g := range m[1:] {
			if g != "" {
				if v, err := strconv.Atoi(g); err == nil {
					return &v
				}
			}
		}
	}
	return nil
}

type bnfSRUResponse struct {
	Records struct {
		Record []bnfSRURecord `xml:"record"`
	} `xml:"records"`
}

type bnfSRURecord struct {
	RecordIdentifier string `xml:"recordIdentifier"`
	RecordData       struct {
		DC bnfDublinCore `xml:"dc"`
	} `xml:"recordData"`
}

type bnfDublinCore struct {
	Title       []string `xml:"title"`
	Creator     []string `xml:"creator"`
	Contributor []string `xml:"contributor"`
	Date        []string `xml:"date"`
	Format      []string `xml:"format"`
	Description []string `xml:"description"`
	Identifier  []string `xml:"identifier"`
}

func fetchBnfRecords(queryStr string, maxRecords int, timeoutSec int) ([]bnfSRURecord, error) {
	urlStr := fmt.Sprintf(
		"%s?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=%d&query=%s",
		BnfSRUBaseURL, maxRecords, url.QueryEscape(queryStr),
	)
	client := &http.Client{Timeout: time.Duration(timeoutSec) * time.Second}
	req, err := http.NewRequest(http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", BnfUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	xmlData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var sru bnfSRUResponse
	if err := xml.Unmarshal(xmlData, &sru); err != nil {
		return nil, err
	}
	return sru.Records.Record, nil
}

func SearchBnfBook(
	title string,
	seriesName string,
	editorName string,
	volume *int,
	isVariant bool,
	timeoutSec int,
) *BnfBookData {
	if timeoutSec <= 0 {
		timeoutSec = 8
	}

	baseTitle := seriesName
	if baseTitle == "" {
		canonS, _ := ExtractCanonicalSeriesAndVolume(title)
		baseTitle = canonS
	}
	if baseTitle == "" {
		baseTitle = StripVariantSuffix(title)
	}

	cleanTitle := CleanTitleForCQL(baseTitle)
	if cleanTitle == "" {
		cleanTitle = CleanTitleForCQL(title)
	}
	if cleanTitle == "" {
		return nil
	}

	publisherTerm := CleanPublisherForCQL(editorName)
	var queries []string
	if publisherTerm != "" {
		queries = append(queries, fmt.Sprintf(`(bib.title all "%s") and (bib.publisher all "%s")`, cleanTitle, publisherTerm))
	}
	queries = append(queries, fmt.Sprintf(`(bib.title all "%s")`, cleanTitle))

	var records []bnfSRURecord
	for _, q := range queries {
		recs, err := fetchBnfRecords(q, 25, timeoutSec)
		if err != nil {
			log.Printf("BNF SRU query failed for '%s': %v", q, err)
			continue
		}
		if len(recs) > 0 {
			records = recs
			break
		}
	}

	if len(records) == 0 {
		return nil
	}

	var candidates []BnfBookData
	for _, rec := range records {
		dc := rec.RecordData.DC
		if len(dc.Title) == 0 {
			continue
		}
		bnfTitle := CleanText(dc.Title[0])
		if bnfTitle == "" {
			continue
		}

		var isbns []string
		for _, idTxt := range dc.Identifier {
			if m := reBnfISBNIdentifier.FindStringSubmatch(idTxt); len(m) > 1 {
				cleanISBN := ReBnfNonISBN.ReplaceAllString(m[1], "")
				if len(cleanISBN) == 10 || len(cleanISBN) == 13 {
					isbns = append(isbns, cleanISBN)
				}
			}
		}
		if len(isbns) == 0 {
			continue
		}

		recVol := ExtractBnfVolume(bnfTitle)
		recIsVariant := IsVariantTitle(bnfTitle) || reBnfVariantExtra.MatchString(bnfTitle)

		var pageCount *int
		for _, fmtStr := range dc.Format {
			if pc := ParseBnfPageCount(fmtStr); pc != nil {
				pageCount = pc
				break
			}
		}

		collectionName := ""
		for _, descStr := range dc.Description {
			if col := ParseBnfCollection(descStr); col != "" {
				collectionName = col
				break
			}
		}

		var releaseDate *time.Time
		if len(dc.Date) > 0 {
			releaseDate = ParseBnfDate(dc.Date[0])
		}

		var authors []ScrapedAuthor
		allCreators := append([]string{}, dc.Creator...)
		allCreators = append(allCreators, dc.Contributor...)
		for _, cr := range allCreators {
			if strings.TrimSpace(cr) != "" {
				first, last, role := ParseBnfCreator(cr)
				if last != "" {
					authors = append(authors, ScrapedAuthor{
						Firstname: first,
						Lastname:  last,
						Role:      role,
					})
				}
			}
		}

		candidates = append(candidates, BnfBookData{
			ISBN:           isbns[0],
			Title:          bnfTitle,
			Volume:         recVol,
			IsVariant:      recIsVariant,
			PageCount:      pageCount,
			CollectionName: collectionName,
			ReleaseDate:    releaseDate,
			Authors:        authors,
			Ark:            rec.RecordIdentifier,
		})
	}

	if len(candidates) == 0 {
		return nil
	}

	type scoredCandidate struct {
		score int
		cand  BnfBookData
	}
	var scored []scoredCandidate

	for _, c := range candidates {
		score := 0
		if volume != nil {
			if c.Volume != nil && *c.Volume == *volume {
				score += 60
			} else if c.Volume == nil {
				score += 5
			} else {
				score -= 60
			}
		} else if c.Volume != nil && *c.Volume > 1 {
			score -= 20
		}

		if isVariant {
			if c.IsVariant {
				score += 40
			} else {
				score -= 30
			}
		} else {
			if !c.IsVariant {
				score += 30
			} else {
				score -= 40
			}
		}

		scored = append(scored, scoredCandidate{score: score, cand: c})
	}

	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	best := scored[0]
	if best.score >= 10 {
		log.Printf(
			"BNF match for '%s' (vol %v, variant=%v): ISBN=%s, BNF title='%s' (score=%d)",
			title, volume, isVariant, best.cand.ISBN, best.cand.Title, best.score,
		)
		return &best.cand
	}

	return nil
}

func LookupBnfByISBN(isbn string, timeoutSec int) *BnfBookData {
	if isbn == "" {
		return nil
	}
	cleanISBN := ReBnfNonISBN.ReplaceAllString(isbn, "")
	if len(cleanISBN) != 10 && len(cleanISBN) != 13 {
		return nil
	}
	if timeoutSec <= 0 {
		timeoutSec = 6
	}

	query := fmt.Sprintf(`bib.isbn all "%s"`, cleanISBN)
	records, err := fetchBnfRecords(query, 5, timeoutSec)
	if err != nil {
		log.Printf("BNF ISBN lookup failed for %s: %v", cleanISBN, err)
		return nil
	}
	if len(records) == 0 {
		return nil
	}

	for _, rec := range records {
		dc := rec.RecordData.DC
		if len(dc.Title) == 0 && len(dc.Format) == 0 && len(dc.Identifier) == 0 {
			continue
		}

		bnfTitle := ""
		if len(dc.Title) > 0 {
			bnfTitle = CleanText(dc.Title[0])
		}

		var pageCount *int
		for _, fmtStr := range dc.Format {
			if pc := ParseBnfPageCount(fmtStr); pc != nil {
				pageCount = pc
				break
			}
		}

		collectionName := ""
		for _, descStr := range dc.Description {
			if col := ParseBnfCollection(descStr); col != "" {
				collectionName = col
				break
			}
		}

		var releaseDate *time.Time
		if len(dc.Date) > 0 {
			releaseDate = ParseBnfDate(dc.Date[0])
		}

		var authors []ScrapedAuthor
		allCreators := append([]string{}, dc.Creator...)
		allCreators = append(allCreators, dc.Contributor...)
		for _, cr := range allCreators {
			if strings.TrimSpace(cr) != "" {
				first, last, role := ParseBnfCreator(cr)
				if last != "" {
					authors = append(authors, ScrapedAuthor{
						Firstname: first,
						Lastname:  last,
						Role:      role,
					})
				}
			}
		}

		var recVol *int
		if bnfTitle != "" {
			recVol = ExtractBnfVolume(bnfTitle)
		}

		return &BnfBookData{
			ISBN:           cleanISBN,
			Title:          bnfTitle,
			Volume:         recVol,
			PageCount:      pageCount,
			CollectionName: collectionName,
			ReleaseDate:    releaseDate,
			Authors:        authors,
		}
	}

	return nil
}
