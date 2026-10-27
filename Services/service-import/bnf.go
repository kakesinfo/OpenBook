package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
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
	reBnfPageCount      = regexp.MustCompile(`(?i)\[?(?:ca\s*)?(\d{2,4})\]?\s*p(?:ages?)?\.?\b`)
	reBnfYear           = regexp.MustCompile(`\b(19\d{2}|20\d{2})\b`)
	reBnfFullDate       = regexp.MustCompile(`(\d{4})-(\d{2})-(\d{2})`)
	reBnfVolume         = regexp.MustCompile(`(?i)(?:[\.\s,]+0?(\d+)|t(?:ome)?\s*0?(\d+)|vol(?:ume)?\s*0?(\d+)|n°\s*0?(\d+)|\[(\d+)\])`)
	reBnfISBNIdentifier = regexp.MustCompile(`(?:ISBN|EAN)\s*([0-9Xx\-]{10,17})`)
	reBnfNonISBN        = regexp.MustCompile(`[^0-9Xx]`)
)

type BnfBookData struct {
	ISBN        string
	Title       string
	Volume      *int
	PageCount   *int
	ReleaseDate *time.Time
	Authors     []string
	DocType     string // Roman, Manga, Bande dessinée, Comics
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
	Type        []string `xml:"type"`
	Subject     []string `xml:"subject"`
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

func cleanTitleForCQL(text string) string {
	cleaned := cleanText(text)
	cleaned = reBnfCQLChars.ReplaceAllString(cleaned, " ")
	return strings.Join(strings.Fields(cleaned), " ")
}

func cleanAuthorForCQL(author string) string {
	cleaned := cleanText(author)
	cleaned = reBnfCQLChars.ReplaceAllString(cleaned, " ")
	parts := strings.Fields(cleaned)
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func cleanPublisherForCQL(editorName string) string {
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
	case strings.Contains(low, "toussaint"):
		return "Toussaint"
	case strings.Contains(low, "laffont"):
		return "Laffont"
	case strings.Contains(low, "bourgois"):
		return "Bourgois"
	case strings.Contains(low, "albin"):
		return "Albin"
	case strings.Contains(low, "bragelonne"):
		return "Bragelonne"
	case strings.Contains(low, "tripode"):
		return "Tripode"
	case strings.Contains(low, "fayard"):
		return "Fayard"
	case strings.Contains(low, "gallimard"):
		return "Gallimard"
	case strings.Contains(low, "pocket"):
		return "Pocket"
	}
	ed = strings.Trim(reBnfPubCleanup.ReplaceAllString(ed, ""), " -:")
	return ed
}

func parseBnfCreator(raw string) string {
	rawClean := cleanText(raw)
	cleaned := reBnfCreatorRoles.ReplaceAllString(rawClean, "")
	cleaned = reBnfCreatorDates.ReplaceAllString(cleaned, "")
	cleaned = reBnfCreatorFunc.ReplaceAllString(cleaned, "")
	cleaned = strings.Trim(cleaned, " .,;:-")

	parts := strings.SplitN(cleaned, ",", 2)
	if len(parts) == 2 {
		last := strings.TrimSpace(parts[0])
		first := strings.TrimSpace(parts[1])
		first = reBnfCreatorDates.ReplaceAllString(first, "")
		return strings.TrimSpace(first + " " + last)
	}
	return strings.TrimSpace(cleaned)
}

func parseBnfPageCount(formatStr string) *int {
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

func parseBnfDate(dateStr string) *time.Time {
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

// SearchBnfBook queries the BNF SRU catalog to enrich missing ISBN, pages, and metadata.
func SearchBnfBook(
	title string,
	author string,
	editorName string,
	volume *int,
	timeoutSec int,
) *BnfBookData {
	if timeoutSec <= 0 {
		timeoutSec = 6
	}
	cleanT := cleanTitleForCQL(title)
	if cleanT == "" {
		return nil
	}

	publisherTerm := cleanPublisherForCQL(editorName)
	authorTerm := cleanAuthorForCQL(author)

	var queries []string
	if publisherTerm != "" && authorTerm != "" {
		queries = append(queries, fmt.Sprintf(`(bib.title all "%s") and (bib.publisher all "%s") and (bib.author all "%s")`, cleanT, publisherTerm, authorTerm))
	}
	if publisherTerm != "" {
		queries = append(queries, fmt.Sprintf(`(bib.title all "%s") and (bib.publisher all "%s")`, cleanT, publisherTerm))
	}
	if authorTerm != "" {
		queries = append(queries, fmt.Sprintf(`(bib.title all "%s") and (bib.author all "%s")`, cleanT, authorTerm))
	}
	queries = append(queries, fmt.Sprintf(`(bib.title all "%s")`, cleanT))

	var records []bnfSRURecord
	for _, q := range queries {
		recs, err := fetchBnfRecords(q, 8, timeoutSec)
		if err != nil {
			log.Printf("[BNF] SRU query failed for '%s': %v", q, err)
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

	for _, rec := range records {
		dc := rec.RecordData.DC
		if len(dc.Title) == 0 {
			continue
		}

		// Filter out sound recordings / audio / video / maps
		isNonBook := false
		for _, t := range dc.Type {
			lt := strings.ToLower(t)
			if strings.Contains(lt, "enregistrement sonore") || strings.Contains(lt, "sound recording") || strings.Contains(lt, "vidéo") || strings.Contains(lt, "carte") || strings.Contains(lt, "musique") {
				isNonBook = true
				break
			}
		}
		if isNonBook {
			continue
		}

		// Find ISBN
		var isbns []string
		for _, idTxt := range dc.Identifier {
			if m := reBnfISBNIdentifier.FindStringSubmatch(idTxt); len(m) > 1 {
				cleanISBN := reBnfNonISBN.ReplaceAllString(m[1], "")
				if len(cleanISBN) == 10 || len(cleanISBN) == 13 {
					isbns = append(isbns, cleanISBN)
				}
			}
		}
		if len(isbns) == 0 {
			continue
		}

		var pageCount *int
		for _, fmtStr := range dc.Format {
			if pc := parseBnfPageCount(fmtStr); pc != nil {
				pageCount = pc
				break
			}
		}

		var releaseDate *time.Time
		if len(dc.Date) > 0 {
			releaseDate = parseBnfDate(dc.Date[0])
		}

		var authors []string
		allCreators := append([]string{}, dc.Creator...)
		allCreators = append(allCreators, dc.Contributor...)
		for _, cr := range allCreators {
			auth := parseBnfCreator(cr)
			if auth != "" {
				authors = append(authors, auth)
			}
		}

		// Detect document type from BNF formats / descriptions / subjects / titles
		docType := ""
		fullMetaText := strings.ToLower(strings.Join(dc.Title, " ") + " " + strings.Join(dc.Format, " ") + " " + strings.Join(dc.Description, " ") + " " + strings.Join(dc.Subject, " "))
		if strings.Contains(fullMetaText, "bande dessinée") || strings.Contains(fullMetaText, "bandes dessinées") || strings.Contains(fullMetaText, "bande-dessinée") {
			docType = "Bande dessinée"
		} else if strings.Contains(fullMetaText, "manga") {
			docType = "Manga"
		} else if strings.Contains(fullMetaText, "comic") {
			docType = "Comics"
		} else if strings.Contains(fullMetaText, "roman") || strings.Contains(fullMetaText, "fiction") || strings.Contains(fullMetaText, "nouvelles") || strings.Contains(fullMetaText, "récit") {
			docType = "Roman"
		}

		return &BnfBookData{
			ISBN:        isbns[0],
			Title:       cleanText(dc.Title[0]),
			Volume:      volume,
			PageCount:   pageCount,
			ReleaseDate: releaseDate,
			Authors:     authors,
			DocType:     docType,
		}
	}

	return nil
}
