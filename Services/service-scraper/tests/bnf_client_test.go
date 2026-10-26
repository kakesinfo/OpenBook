package tests

import (
	"strings"
	"testing"

	"yet-another-library/service-scraper/scrapers"
)

func TestCleanTitleForCQL(t *testing.T) {
	cleaned := scrapers.CleanTitleForCQL(`X-Men: Shadows (Collector) - Tome "1"`)
	if strings.Contains(cleaned, ":") {
		t.Errorf("expected no ':' in %q", cleaned)
	}
	if strings.Contains(cleaned, "(") || strings.Contains(cleaned, ")") {
		t.Errorf("expected no parentheses in %q", cleaned)
	}
	if strings.Contains(cleaned, `"`) {
		t.Errorf("expected no quotes in %q", cleaned)
	}
	if !strings.Contains(cleaned, "Men") || !strings.Contains(cleaned, "Shadows") {
		t.Errorf("expected 'Men' and 'Shadows' in %q", cleaned)
	}
}

func TestCleanPublisherForCQL(t *testing.T) {
	if got := scrapers.CleanPublisherForCQL("Panini Comics"); got != "Panini" {
		t.Errorf("got %q, want %q", got, "Panini")
	}
	if got := scrapers.CleanPublisherForCQL("Urban Comics"); got != "Urban" {
		t.Errorf("got %q, want %q", got, "Urban")
	}
	if got := scrapers.CleanPublisherForCQL("Mangetsu"); got != "Mangetsu" {
		t.Errorf("got %q, want %q", got, "Mangetsu")
	}
}

func TestParseBnfPageCount(t *testing.T) {
	p1 := scrapers.ParseBnfPageCount("1 vol. (176 p.) : ill. en coul. ; 26 cm")
	if p1 == nil || *p1 != 176 {
		t.Errorf("got %v, want 176", p1)
	}
	p2 := scrapers.ParseBnfPageCount("1 vol. ([880] p.) : ill. en coul. ; 29 cm")
	if p2 == nil || *p2 != 880 {
		t.Errorf("got %v, want 880", p2)
	}
	p3 := scrapers.ParseBnfPageCount("Pagination multiple")
	if p3 != nil {
		t.Errorf("got %v, want nil", p3)
	}
}

func TestParseBnfCollection(t *testing.T) {
	if got := scrapers.ParseBnfCollection("Collection : Marvel Deluxe"); got != "Marvel Deluxe" {
		t.Errorf("got %q, want %q", got, "Marvel Deluxe")
	}
	if got := scrapers.ParseBnfCollection("Collection : Comics. Marvel omnibus"); got != "Marvel omnibus" {
		t.Errorf("got %q, want %q", got, "Marvel omnibus")
	}
}

func TestParseBnfCreator(t *testing.T) {
	first, last, role := scrapers.ParseBnfCreator("Carey, Mike (1959-....). Auteur du texte")
	if first != "Mike" || last != "Carey" || role != "Writer" {
		t.Errorf("got (%q, %q, %q), want (Mike, Carey, Writer)", first, last, role)
	}

	first, last, role = scrapers.ParseBnfCreator("Pasqual Ferry (1961-....). Illustrateur")
	if last != "Pasqual Ferry" || role != "Illustrator" {
		t.Errorf("got (%q, %q, %q), want ('', 'Pasqual Ferry', 'Illustrator')", first, last, role)
	}
}

func TestParseBnfDate(t *testing.T) {
	d1 := scrapers.ParseBnfDate("2026")
	if d1 == nil || d1.Year() != 2026 {
		t.Errorf("got %v, want year 2026", d1)
	}

	d2 := scrapers.ParseBnfDate("2026-03-15")
	if d2 == nil || int(d2.Month()) != 3 {
		t.Errorf("got %v, want month 3", d2)
	}
}

func TestExtractBnfVolume(t *testing.T) {
	v1 := scrapers.ExtractBnfVolume("Ultimate Fantastic Four. 2")
	if v1 == nil || *v1 != 2 {
		t.Errorf("got %v, want 2", v1)
	}
	v2 := scrapers.ExtractBnfVolume("X-Men, Shadows of tomorrow. 04 [Édition collector]")
	if v2 == nil || *v2 != 4 {
		t.Errorf("got %v, want 4", v2)
	}
}

func TestLookupBnfByISBNInvalid(t *testing.T) {
	if res := scrapers.LookupBnfByISBN("", 1); res != nil {
		t.Errorf("expected nil for empty ISBN, got %v", res)
	}
	if res := scrapers.LookupBnfByISBN("123", 1); res != nil {
		t.Errorf("expected nil for short ISBN, got %v", res)
	}
}
