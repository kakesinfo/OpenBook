package scrapers

import (
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type ScrapedAuthor struct {
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	Role      string `json:"role"` // "Writer", "Illustrator", "Colorist", "Translator", etc.
}

type ScrapedBook struct {
	Title           string          `json:"title"`
	SeriesName      string          `json:"series_name"`
	SeriesQualifier string          `json:"series_qualifier,omitempty"`
	Volume          *int            `json:"volume"`
	ISBN            string          `json:"isbn"`
	EditorName      string          `json:"editor_name"`
	CollectionName  string          `json:"collection_name"`
	CategoryName    string          `json:"category_name"`
	PageCount       int             `json:"page_count"`
	Price           int             `json:"price"`
	Description     string          `json:"description"`
	CoverURL        string          `json:"cover_url"`
	ReleaseDate     *time.Time      `json:"release_date"`
	BookType        string          `json:"book_type"`
	Authors         []ScrapedAuthor `json:"authors"`
	SourceURL       string          `json:"source_url"`
	ParentBookID    *int            `json:"parent_book_id,omitempty"`
	IsVariant       bool            `json:"is_variant"`
}

type BaseScraper interface {
	Name() string
	DisplayName() string
	Description() string
	Color() string
	Scrape(maxItems int, fullScan bool, onBookFound func(ScrapedBook), isStopped func() bool) ([]ScrapedBook, error)
}

var (
	reUnicodeDashes = regexp.MustCompile(`[\x{2010}\x{2011}\x{2012}\x{2013}\x{2014}\x{2015}\x{2212}]`)
	reSingleQuotes  = regexp.MustCompile(`[\x{2018}\x{2019}\x{201a}\x{201b}]`)
	reDoubleQuotes  = regexp.MustCompile(`[\x{201c}\x{201d}\x{201e}\x{201f}]`)
	reWhitespace    = regexp.MustCompile(`[ \t\x{00a0}\x{2000}-\x{200b}]+`)

	authorRolePrefixRegex = regexp.MustCompile(
		`(?i)^(?:par\s+|de\s+|d['’]|` +
			`texte\s+et\s+illustrations?\s+(?:de\s*)?|` +
			`sc[eé]nariste\s+et\s+dessinateur\s*|` +
			`sc[eé]nario\s+et\s+dessin\s+(?:de\s*)?|` +
			`sc[eé]nario\s+(?:de\s*)?|` +
			`illustrations?\s+(?:de\s*)?|` +
			`dessins?\s+(?:de\s*)?|` +
			`auteurs?\s*(?:\+|/|et)\s*illustrat(?:eur|rice)s?\s*|` +
			`illustrat(?:eur|rice)s?\s*|` +
			`dessinat(?:eur|rice)s?\s*|` +
			`sc[eé]naristes?\s*|` +
			`coloristes?\s*|` +
			`auteurs?\s*|` +
			`auteures?\s*|` +
			`[\+:\-_/]\s*)+`,
	)

	variantCoverRegex = regexp.MustCompile(
		`(?i)\b(?:couverture\s+variante|variant(?:e)?(?:\s+(?:panini|exclusive|site))?|couv\.?\s*var\.?|(?:[eé]dition|coffret)\s+collector|collector|[eé]dition\s+sp[eé]ciale|[eé]dition\s+limit[eé]e|[eé]dition\s+prestige|tirage\s+(?:limit[eé]|de\s+t[eê]te)|(?:version|[eé]dition\s+)?noir\s+et\s+blanc|n&b)\b`,
	)

	variantSuffixRegex = regexp.MustCompile(
		`(?i)(?:\s*[-\x{2013}\x{2014}:]\s*|\s+)\(?(?:couverture\s+variante|variant(?:e)?(?:\s+(?:panini|exclusive|site))?|couv\.?\s*var\.?|(?:[eé]dition|coffret)\s+collector|collector|[eé]dition\s+sp[eé]ciale|[eé]dition\s+limit[eé]e|[eé]dition\s+prestige|tirage\s+(?:limit[eé]|de\s+t[eê]te)|(?:version|[eé]dition\s+)?noir\s+et\s+blanc|n&b)\b[^\)]*\)?`,
	)

	variantCoverFileRegex = regexp.MustCompile(`(?i)[a-zA-Z0-9]+v_\d+\.(?:jpg|jpeg|png|webp)`)
	variantSKURegex       = regexp.MustCompile(`(?i)[a-zA-Z0-9]+v(?:_[a-zA-Z0-9]+)?$`)

	canonVolExtractRegex = regexp.MustCompile(`(?i)(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?(\d+)`)
	canonVolStripRegex   = regexp.MustCompile(`(?i)(?:T(?:ome)?|Vol(?:ume)?|N°|#)\s*0?\d+.*`)
)

// CleanText cleans raw scraped text:
// - Decodes HTML entities
// - Repairs double-encoded UTF-8 / mojibake
// - Normalizes unicode dashes and quotes
// - Collapses whitespace
func CleanText(text string) string {
	if text == "" {
		return ""
	}

	cleaned := html.UnescapeString(text)

	if strings.Contains(cleaned, "Ã") || strings.Contains(cleaned, "Â") || strings.Contains(cleaned, "â€™") || strings.Contains(cleaned, "â„¢") {
		if repaired, ok := tryDecodeLatin1AsUTF8(cleaned); ok {
			cleaned = repaired
		}
	}

	cleaned = reUnicodeDashes.ReplaceAllString(cleaned, "-")
	cleaned = reSingleQuotes.ReplaceAllString(cleaned, "'")
	cleaned = reDoubleQuotes.ReplaceAllString(cleaned, `"`)
	cleaned = reWhitespace.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

func tryDecodeLatin1AsUTF8(s string) (string, bool) {
	buf := make([]byte, 0, len(s))
	for _, r := range s {
		if r > 255 {
			return s, false
		}
		buf = append(buf, byte(r))
	}
	if utf8.Valid(buf) {
		return string(buf), true
	}
	return s, false
}

// CleanAuthorName removes role and descriptive prefixes from author names.
func CleanAuthorName(name string) string {
	if name == "" {
		return ""
	}
	cleaned := strings.TrimSpace(CleanText(name))
	for {
		m := strings.Trim(authorRolePrefixRegex.ReplaceAllString(cleaned, ""), " +:-_/")
		if m == cleaned {
			break
		}
		cleaned = m
	}
	return cleaned
}

// SplitAuthorName cleans and splits a full author name into (firstname, lastname).
// Handles mononyms (e.g. 'RUN', 'Neyef') by returning (”, 'RUN').
func SplitAuthorName(fullName string) (string, string) {
	cleaned := CleanAuthorName(fullName)
	if cleaned == "" {
		return "", ""
	}
	parts := strings.Fields(cleaned)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return "", parts[0]
	}
	idx := strings.IndexFunc(cleaned, unicode.IsSpace)
	if idx == -1 {
		return "", cleaned
	}
	first := strings.TrimSpace(cleaned[:idx])
	last := strings.TrimSpace(cleaned[idx:])
	return first, last
}

func IsVariantTitle(title string) bool {
	if title == "" {
		return false
	}
	return variantCoverRegex.MatchString(title)
}

func StripVariantSuffix(text string) string {
	cleaned := CleanText(text)
	if cleaned == "" {
		return ""
	}
	res := strings.Trim(variantSuffixRegex.ReplaceAllString(cleaned, ""), " -:")
	if strings.HasSuffix(res, "(") && strings.Count(res, "(") > strings.Count(res, ")") {
		res = strings.Trim(res[:len(res)-1], " -:")
	}
	if strings.HasSuffix(res, ")") && strings.Count(res, ")") > strings.Count(res, "(") {
		res = strings.Trim(res[:len(res)-1], " -:")
	}
	if res == "" {
		return cleaned
	}
	return res
}

func IsVariantBook(title string, coverURL string, sku string) bool {
	if IsVariantTitle(title) {
		return true
	}
	if coverURL != "" && variantCoverFileRegex.MatchString(coverURL) {
		return true
	}
	if sku != "" && variantSKURegex.MatchString(sku) {
		return true
	}
	return false
}

func ExtractCanonicalSeriesAndVolume(seriesOrTitle string) (string, *int) {
	cleaned := CleanText(seriesOrTitle)
	var vol *int
	if m := canonVolExtractRegex.FindStringSubmatch(cleaned); len(m) > 1 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			vol = &v
		}
	}

	base := strings.Trim(canonVolStripRegex.ReplaceAllString(cleaned, ""), " -:")
	if strings.HasSuffix(base, "(") && strings.Count(base, "(") > strings.Count(base, ")") {
		base = strings.Trim(base[:len(base)-1], " -:")
	}
	if strings.HasSuffix(base, ")") && strings.Count(base, ")") > strings.Count(base, "(") {
		base = strings.Trim(base[:len(base)-1], " -:")
	}
	base = StripVariantSuffix(base)
	if base == "" {
		base = cleaned
	}
	return CleanText(base), vol
}

func TruncateString(s string, maxRunes int) string {
	runes := []rune(s)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes])
	}
	return s
}

func CapitalizeWord(s string) string {
	if s == "" {
		return ""
	}
	runes := []rune(strings.ToLower(s))
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

func TitleCaseWords(s string) string {
	words := strings.Fields(s)
	for i, w := range words {
		words[i] = CapitalizeWord(w)
	}
	return strings.Join(words, " ")
}
