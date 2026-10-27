package main

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Importer struct {
	db     *Database
	media  *MediaClient
	config *Config
	jobsMu sync.RWMutex
	jobs   map[string]*ImportJob
}

func NewImporter(cfg *Config, db *Database, media *MediaClient) *Importer {
	return &Importer{
		db:     db,
		media:  media,
		config: cfg,
		jobs:   make(map[string]*ImportJob),
	}
}

func (imp *Importer) GetJob(id string) *ImportJob {
	imp.jobsMu.RLock()
	defer imp.jobsMu.RUnlock()
	return imp.jobs[id]
}

func (imp *Importer) CreateJob(userID int) *ImportJob {
	job := &ImportJob{
		ID:          uuid.New().String(),
		UserID:      userID,
		Status:      "pending",
		CurrentStep: "Initialisation...",
		Errors:      make([]string, 0),
		StartedAt:   time.Now(),
	}
	imp.jobsMu.Lock()
	imp.jobs[job.ID] = job
	imp.jobsMu.Unlock()
	return job
}

func (imp *Importer) RunImportAsync(job *ImportJob, zipPath string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Importer] Panic in import job %s: %v", job.ID, r)
				job.Status = "failed"
				job.Errors = append(job.Errors, fmt.Sprintf("Internal error: %v", r))
				now := time.Now()
				job.FinishedAt = &now
			}
		}()

		imp.RunImportSync(job, zipPath)
	}()
}

func (imp *Importer) RunImportSync(job *ImportJob, zipPath string) {
	job.Status = "processing"
	job.CurrentStep = "Décompression et lecture de l'archive..."

	parsed, err := ParseBookmoryZip(zipPath)
	if err != nil {
		job.Status = "failed"
		job.Errors = append(job.Errors, fmt.Sprintf("Erreur de lecture du fichier .bookmory: %v", err))
		now := time.Now()
		job.FinishedAt = &now
		return
	}
	defer parsed.Close()

	total := len(parsed.Books)
	job.TotalBooks = total
	job.CurrentStep = fmt.Sprintf("Importation des %d albums...", total)

	log.Printf("[Importer] Starting import of %d books for user %d (job %s)", total, job.UserID, job.ID)

	// Semaphores for concurrent media cover downloads/uploads
	mediaSem := make(chan struct{}, imp.config.MaxMediaConcurrency)

	for i, b := range parsed.Books {
		imp.processSingleBook(job, b, parsed, mediaSem)
		job.ProcessedBooks = i + 1
	}

	job.Status = "completed"
	job.CurrentStep = "Importation terminée avec succès."
	now := time.Now()
	job.FinishedAt = &now

	log.Printf("[Importer] Job %s completed: %d created, %d updated, %d purchases, %d reading sessions",
		job.ID, job.CreatedBooks, job.UpdatedBooks, job.ImportedPurchases, job.ImportedReadingSessions)
}

func normalizeText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	repl := strings.NewReplacer(
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"à", "a", "â", "a", "ä", "a",
		"î", "i", "ï", "i",
		"ô", "o", "ö", "o",
		"û", "u", "ü", "u",
		"-", " ", "_", " ", ".", " ",
	)
	return repl.Replace(s)
}

func determineTypeFromPublisher(pub string) string {
	norm := normalizeText(pub)
	if norm == "" {
		return ""
	}
	// Manga publishers
	mangaPubs := []string{
		"mangetsu", "kaze", "kurokawa", "ki oon", "kana", "pika",
		"akata", "meian", "taifu", "ototo", "nobi nobi", "vega", "kbooks",
		"panini manga", "glenat manga", "komikku", "crunchyroll",
	}
	for _, p := range mangaPubs {
		if strings.Contains(norm, p) {
			return "Manga"
		}
	}

	// Roman publishers
	romanPubs := []string{
		"robert laffont", "laffont", "albin michel", "bourgois", "bragelonne", "fayard",
		"le tripode", "tripode", "gallimard", "pocket", "j'ai lu", "flammarion", "actes sud",
		"seuil", "livre de poche", "toussaint louverture", "10 18",
		"archipoche", "belfond", "berkley", "castelmore", "cherche midi",
		"city", "denoel", "gallmeister", "milady", "sonatine",
		"folio", "bloomsbury", "barnes & noble", "entangled",
		"red tower", "de la martiniere jeunesse", "ecole des loisirs", "calix",
		"gloriana", "astrolabe", "ed du masque", "jove", "harpercollins",
		"penguin", "pocket jeunesse", "pkj", "hachette", "grasset",
		"rivages", "plon", "calmann levy", "l'atalante",
		"atalante", "mnemos", "belial", "critic",
		"odile jacob", "puf", "les belles lettres", "payot",
	}
	for _, p := range romanPubs {
		if strings.Contains(norm, p) {
			return "Roman"
		}
	}

	// Comics publishers
	comicsPubs := []string{
		"urban comics", "urban", "panini comics", "panini", "dc comics",
		"marvel", "image", "dark horse", "bliss comics", "bliss", "hicomics",
		"bubble editions", "bubble", "caurette", "404 editions",
		"komics initiative", "komics initiati", "komics",
		"huginn", "muninn", "delirium", "black river", "kinaye",
	}
	for _, p := range comicsPubs {
		if strings.Contains(norm, p) {
			return "Comics"
		}
	}

	// BD publishers
	bdPubs := []string{
		"dargaud", "le lombard", "lombard", "dupuis", "casterman",
		"rue de sevres", "sevres", "humanoide", "humanoïdes",
		"soleil", "futuropolis", "bamboo",
		"cornelius", "ankama", "glenat", "label 619",
	}
	for _, p := range bdPubs {
		if strings.Contains(norm, p) {
			return "Bande dessinée"
		}
	}

	return ""
}

func determineBookType(b *BookmoryBook, editorName string, bnfData *BnfBookData, bookTags []string) string {
	// 1. Check tags (from both bookTags and b.Tags string)
	var allTagParts []string
	if b.Tags != "" {
		allTagParts = append(allTagParts, b.Tags)
	}
	allTagParts = append(allTagParts, bookTags...)
	allTags := normalizeText(strings.Join(allTagParts, " "))

	if strings.Contains(allTags, "manga") {
		return "Manga"
	}
	if strings.Contains(allTags, "superheros") || strings.Contains(allTags, "super heroes") || strings.Contains(allTags, "comics") || strings.Contains(allTags, "marvel") || strings.Contains(allTags, "xmen") || strings.Contains(allTags, "wonderwoman") || strings.Contains(allTags, "batman") || strings.Contains(allTags, "dccomics") {
		return "Comics"
	}
	if strings.Contains(allTags, "bandedessinee") || strings.Contains(allTags, "bandesdessinees") || strings.Contains(allTags, "bande dessinee") || strings.Contains(allTags, "bandes dessinees") || strings.Contains(allTags, "#bd") {
		return "Bande dessinée"
	}
	if strings.Contains(allTags, "novel") || strings.Contains(allTags, "classic") || strings.Contains(allTags, "frenchliterature") || strings.Contains(allTags, "philosophy") || strings.Contains(allTags, "anthropology") || strings.Contains(allTags, "sociology") || strings.Contains(allTags, "history") || strings.Contains(allTags, "science") || strings.Contains(allTags, "audiobook") {
		return "Roman"
	}

	// 2. Check publisher
	if pubType := determineTypeFromPublisher(editorName); pubType != "" {
		return pubType
	}

	// 3. Check BNF data
	if bnfData != nil && bnfData.DocType != "" {
		return bnfData.DocType
	}

	return "Comics"
}

func (imp *Importer) processSingleBook(
	job *ImportJob,
	b *BookmoryBook,
	parsed *ParsedBookmory,
	mediaSem chan struct{},
) {
	cleanT := cleanText(b.Title)
	if cleanT == "" {
		return
	}

	// 1. Process cover image with concurrency control
	coverURL := ""
	if b.Image != "" {
		mediaSem <- struct{}{}
		coverURL = imp.media.ProcessBookCover(b.Image, parsed.ZipImages)
		<-mediaSem
	}

	// 2. Resolve Publisher / Editor
	var editorID *int
	if b.Publisher != "" {
		if eid, err := imp.db.FindOrCreateEditor(b.Publisher); err == nil {
			editorID = eid
		}
	}

	// 3. Resolve Series
	var seriesID *int
	seriesName := ""
	if b.SeriesKey != "" {
		seriesName = parsed.Series[b.SeriesKey]
	}
	if seriesName != "" {
		if sid, err := imp.db.FindOrCreateSeries(seriesName); err == nil {
			seriesID = sid
		}
	}

	// 4. Personal collections from Bookmory are NOT imported as publisher collections
	// (collection_id remains nil per user requirement)

	// 5. Query BNF if ISBN is missing
	var bnfData *BnfBookData
	if strings.TrimSpace(b.ISBN) == "" {
		vol := parseVolume(b.SeriesNumber, b.SeriesNumberDecimal, cleanT)
		var volPtr *int
		if vol > 0 {
			volPtr = &vol
		}
		bnfData = SearchBnfBook(cleanT, b.Author, b.Publisher, volPtr, 6)
		if bnfData != nil {
			if bnfData.ISBN != "" {
				log.Printf("[Importer] Enriched '%s' with BNF ISBN: %s", cleanT, bnfData.ISBN)
				b.ISBN = bnfData.ISBN
			}
			if b.RealTotalPage == 0 && b.TotalPage == 0 && bnfData.PageCount != nil {
				b.RealTotalPage = float64(*bnfData.PageCount)
			}
			if b.PublicationDate == "" && bnfData.ReleaseDate != nil && !bnfData.ReleaseDate.IsZero() {
				b.PublicationDate = bnfData.ReleaseDate.Format("2006-01-02")
			}
		}
	}

	// 6. Determine Book Type (Roman, Manga, Bande dessinée, Comics)
	bookTags := parsed.BookTags[b.Key]
	bookType := determineBookType(b, b.Publisher, bnfData, bookTags)

	// 7. Release date
	relDate := parseReleaseDate(b.PublicationDate, b.CreatedAt)

	// 8. Check if Book already exists in database
	existing, err := imp.db.FindBook(b.ISBN, cleanT)
	var bookID int

	if err != nil {
		log.Printf("[Importer] Error querying book '%s': %v", cleanT, err)
	}

	if existing != nil {
		// Book EXISTS -> update cover and information if different
		bookID = existing.ID
		updated, uErr := imp.db.UpdateExistingBook(existing, b, coverURL, editorID, seriesID, relDate, bookType)
		if uErr != nil {
			job.Errors = append(job.Errors, fmt.Sprintf("Erreur mise à jour '%s': %v", cleanT, uErr))
		} else if updated {
			job.UpdatedBooks++
		}
	} else {
		// Book DOES NOT EXIST -> create it
		newID, cErr := imp.db.CreateNewBook(b, coverURL, editorID, seriesID, relDate, bookType)
		if cErr != nil {
			job.Errors = append(job.Errors, fmt.Sprintf("Erreur création '%s': %v", cleanT, cErr))
			return
		}
		bookID = newID
		job.CreatedBooks++
	}

	// 9. Authors & Illustrators
	allAuthors := make([]string, 0)
	if len(b.Authors) > 0 {
		allAuthors = append(allAuthors, b.Authors...)
	} else if b.Author != "" {
		allAuthors = append(allAuthors, b.Author)
	}
	if len(allAuthors) == 0 && bnfData != nil && len(bnfData.Authors) > 0 {
		allAuthors = append(allAuthors, bnfData.Authors...)
	}

	for _, authorName := range allAuthors {
		if aid, aErr := imp.db.FindOrCreateAuthor(authorName); aErr == nil {
			_ = imp.db.LinkBookAuthor(bookID, aid, 1) // 1 = Writer
		}
	}

	for _, illName := range b.Illustrators {
		if aid, aErr := imp.db.FindOrCreateAuthor(illName); aErr == nil {
			_ = imp.db.LinkBookAuthor(bookID, aid, 2) // 2 = Illustrator
		}
	}

	// 10. User ownership & reading status
	if job.UserID > 0 {
		_ = imp.db.UpsertUserOwnsBook(job.UserID, bookID, b.Wishlist)

		readingStatus := determineReadingStatus(b)
		_ = imp.db.UpsertBookStatus(job.UserID, bookID, readingStatus)

		// 11. Purchases
		for _, purchase := range b.Purchases {
			pCopy := purchase
			if inserted, pErr := imp.db.ImportPurchase(job.UserID, bookID, &pCopy); pErr == nil && inserted {
				job.ImportedPurchases++
			}
		}

		// 12. Reading sessions (temps de lecture)
		for _, read := range b.Reads {
			// Find page log map for matching timestamps
			pageByTime := make(map[int64]int)
			for _, pl := range read.PageLogList {
				pageByTime[pl.CreatedAt] = int(pl.Page)
			}

			for _, timer := range read.ReadTimerList {
				tCopy := timer
				page := int(b.CurPage)
				if p, ok := pageByTime[timer.CreatedAt]; ok && p > 0 {
					page = p
				} else if read.Page > 0 {
					page = int(read.Page)
				} else if b.RealTotalPage > 0 {
					page = int(b.RealTotalPage)
				}

				if inserted, sErr := imp.db.ImportReadingSession(job.UserID, bookID, &tCopy, page); sErr == nil && inserted {
					job.ImportedReadingSessions++
				}
			}
		}
	}
}

func determineReadingStatus(b *BookmoryBook) string {
	for _, s := range b.StatusList {
		switch strings.ToUpper(s) {
		case "DONE":
			return "READ"
		case "PAUSE":
			return "READING"
		case "NOT_STARTED":
			return "TO_READ"
		}
	}

	for _, rd := range b.Reads {
		if strings.EqualFold(rd.Status, "DONE") {
			return "READ"
		}
		if strings.EqualFold(rd.Status, "PAUSE") {
			return "READING"
		}
	}

	if b.CurPage > 0 {
		if b.RealTotalPage > 0 && b.CurPage >= b.RealTotalPage {
			return "READ"
		}
		return "READING"
	}

	return "UNREAD"
}
