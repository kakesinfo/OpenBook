package main

import (
	"time"

	"yet-another-library/service-scraper/scrapers"
)

type BnfBookData = scrapers.BnfBookData

var reBnfNonISBN = scrapers.ReBnfNonISBN

func CleanPublisherForCQL(editorName string) string {
	return scrapers.CleanPublisherForCQL(editorName)
}

func CleanTitleForCQL(text string) string {
	return scrapers.CleanTitleForCQL(text)
}

func ParseBnfCreator(raw string) (string, string, string) {
	return scrapers.ParseBnfCreator(raw)
}

func ParseBnfPageCount(formatStr string) *int {
	return scrapers.ParseBnfPageCount(formatStr)
}

func ParseBnfCollection(descStr string) string {
	return scrapers.ParseBnfCollection(descStr)
}

func ParseBnfDate(dateStr string) *time.Time {
	return scrapers.ParseBnfDate(dateStr)
}

func ExtractBnfVolume(title string) *int {
	return scrapers.ExtractBnfVolume(title)
}

func SearchBnfBook(
	title string,
	seriesName string,
	editorName string,
	volume *int,
	isVariant bool,
	timeoutSec int,
) *BnfBookData {
	return scrapers.SearchBnfBook(title, seriesName, editorName, volume, isVariant, timeoutSec)
}

func LookupBnfByISBN(isbn string, timeoutSec int) *BnfBookData {
	return scrapers.LookupBnfByISBN(isbn, timeoutSec)
}
