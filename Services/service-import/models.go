package main

import (
	"archive/zip"
	"time"
)

// Bookmory JSON models stored in Sembast SQLite database

type BookmoryBook struct {
	Key                 string             `json:"key"`
	Title               string             `json:"title"`
	Author              string             `json:"author"`
	Authors             []string           `json:"authors"`
	Illustrators        []string           `json:"illustrators"`
	Publisher           string             `json:"publisher"`
	ISBN                string             `json:"isbn"`
	PublicationDate     string             `json:"publication_date"`
	Description         string             `json:"description"`
	Tags                string             `json:"tags"`
	PageType            string             `json:"page_type"`
	TotalPage           float64            `json:"total_page"`
	RealTotalPage       float64            `json:"real_total_page"`
	CurPage             float64            `json:"cur_page"`
	Wishlist            bool               `json:"wishlist"`
	SeriesKey           string             `json:"series_key"`
	SeriesNumber        int                `json:"series_number"`
	SeriesNumberDecimal float64            `json:"series_number_decimal"`
	CollectionKeys      []any              `json:"collection_keys"`
	Image               string             `json:"image"`
	Purchases           []BookmoryPurchase `json:"purchases"`
	Reads               []BookmoryRead     `json:"reads"`
	StatusList          []string           `json:"status_list"`
	CreatedAt           int64              `json:"created_at"`
	UpdatedAt           int64              `json:"updated_at"`
	FirstReadStartDate  *int64             `json:"first_read_start_date"`
	LastReadDoneDate    *int64             `json:"last_read_done_date"`
}

type BookmoryPurchase struct {
	From         string  `json:"from"`
	Price        float64 `json:"price"`
	Memo         string  `json:"memo"`
	CurrencyCode string  `json:"currency_code"`
	PurchasedAt  int64   `json:"purchased_at"`
	CreatedAt    int64   `json:"created_at"`
	UpdatedAt    int64   `json:"updated_at"`
}

type BookmoryRead struct {
	Nth           int                 `json:"nth"`
	Start         int64               `json:"start"`
	End           int64               `json:"end"`
	Star          float64             `json:"star"`
	Comment       string              `json:"comment"`
	Status        string              `json:"status"` // DONE, PAUSE
	Page          float64             `json:"page"`
	TotalPage     float64             `json:"total_page"`
	RealTotalPage float64             `json:"real_total_page"`
	PageLogList   []BookmoryPageLog   `json:"page_log_list"`
	ReadTimerList []BookmoryReadTimer `json:"read_timer_list"`
	CreatedAt     int64               `json:"created_at"`
	UpdatedAt     int64               `json:"updated_at"`
}

type BookmoryPageLog struct {
	PageType  string  `json:"page_type"`
	Page      float64 `json:"page"`
	CreatedAt int64   `json:"created_at"`
	UpdatedAt int64   `json:"updated_at"`
}

type BookmoryReadTimer struct {
	ReadStartedAt int64 `json:"read_started_at"`
	ElapsedSec    int   `json:"elapsed_sec"`
	CreatedAt     int64 `json:"created_at"`
	UpdatedAt     int64 `json:"updated_at"`
}

type BookmorySeries struct {
	Name string `json:"name"`
}

type BookmoryPublisher struct {
	Name string `json:"name"`
}

type BookmoryCollection struct {
	Name string `json:"name"`
}

type BookmoryAuthor struct {
	Name string `json:"name"`
}

type BookmoryIllustrator struct {
	Name string `json:"name"`
}

// Database representation of existing book for comparison
type ExistingBook struct {
	ID           int
	Title        string
	ISBN         *string
	Volume       int
	PageCount    int
	Price        int
	Description  *string
	CoverURL     *string
	ReleaseDate  time.Time
	EditorID     *int
	SeriesID     *int
	CollectionID *int
	Type         string
}

// Parsed Bookmory archive data
type ParsedBookmory struct {
	Books        []*BookmoryBook
	Series       map[string]string   // key -> name
	Publishers   map[string]string   // key -> name
	Collections  map[string]string   // key -> name (kept for reference / tags)
	Authors      map[string]string   // key -> name
	Illustrators map[string]string   // key -> name
	Tags         map[string]string   // key -> name
	BookTags     map[string][]string // book key -> list of tag names
	ZipImages    map[string]*zip.File
	TempDir      string
	ZipCloser    *zip.ReadCloser
}

// Import tracking job
type ImportJob struct {
	ID                      string     `json:"id"`
	UserID                  int        `json:"user_id"`
	Status                  string     `json:"status"` // "pending", "processing", "completed", "failed"
	TotalBooks              int        `json:"total_books"`
	ProcessedBooks          int        `json:"processed_books"`
	CreatedBooks            int        `json:"created_books"`
	UpdatedBooks            int        `json:"updated_books"`
	ImportedPurchases       int        `json:"imported_purchases"`
	ImportedReadingSessions int        `json:"imported_reading_sessions"`
	CurrentStep             string     `json:"current_step"`
	Errors                  []string   `json:"errors"`
	StartedAt               time.Time  `json:"started_at"`
	FinishedAt              *time.Time `json:"finished_at,omitempty"`
}

type ImportResponse struct {
	Success bool       `json:"success"`
	Message string     `json:"message"`
	Job     *ImportJob `json:"job,omitempty"`
}
