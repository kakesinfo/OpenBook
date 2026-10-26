package tests

import (
	"reflect"
	"strings"
	"testing"

	"yet-another-library/service-scraper/scrapers"

	"github.com/PuerkitoBio/goquery"
)

func TestRegistry(t *testing.T) {
	expected := []string{"urban_comics", "panini", "morgen_bd", "mangetsu", "label619", "monsieur_toussaint_louverture"}
	for _, name := range expected {
		if _, ok := scrapers.Scrapers[name]; !ok {
			t.Errorf("expected %q in Scrapers registry", name)
		}
		scraper, err := scrapers.GetScraper(name)
		if err != nil {
			t.Fatalf("unexpected error getting scraper %q: %v", name, err)
		}
		if scraper.Name() != name {
			t.Errorf("got scraper.Name() = %q, want %q", scraper.Name(), name)
		}
	}
}

func TestFrenchDateParser(t *testing.T) {
	d1 := scrapers.ParseFrenchDate("21 novembre 2025")
	if d1 == nil || d1.Year() != 2025 || int(d1.Month()) != 11 || d1.Day() != 21 {
		t.Errorf("unexpected date d1: %v", d1)
	}

	d2 := scrapers.ParseFrenchDate("5 mai 2024")
	if d2 == nil || int(d2.Month()) != 5 {
		t.Errorf("unexpected date d2: %v", d2)
	}

	d3 := scrapers.ParseFrenchDate("02 octobre 2026")
	if d3 == nil || d3.Year() != 2026 || int(d3.Month()) != 10 || d3.Day() != 2 {
		t.Errorf("unexpected date d3: %v", d3)
	}
}

func TestSlugTitle(t *testing.T) {
	slug := scrapers.SlugTitle("Absolute Flash Tome 1")
	if slug != "absolute-flash-tome-1" {
		t.Errorf("got %q, want %q", slug, "absolute-flash-tome-1")
	}
}

func TestCleanTextMojibakeRepair(t *testing.T) {
	cases := map[string]string{
		"Le Château des Animaux":  "Le Château des Animaux",
		"Le fils du démon":        "Le fils du démon",
		"X-Men (Intégrale)":       "X-Men (Intégrale)",
		"Siège":                   "Siège",
		"Spider-Man &amp; Batman": "Spider-Man & Batman",
		"L&#x27;aventure":         "L'aventure",
	}
	for input, want := range cases {
		if got := scrapers.CleanText(input); got != want {
			t.Errorf("CleanText(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestCleanAuthorNamePrefixes(t *testing.T) {
	cases := [][2]string{
		{"Auteur + illustrateurMathieu Bablet", "Mathieu Bablet"},
		{"Par Auteur + illustrateurMathieu Bablet", "Mathieu Bablet"},
		{"IllustrateurFlorent Maudoux", "Florent Maudoux"},
		{"Scénariste et dessinateurRun", "Run"},
		{"Texte et illustration deBones", "Bones"},
		{"AuteurNeyef", "Neyef"},
		{"Illustration deRours", "Rours"},
		{"Scénario deIsabelle Bauthian", "Isabelle Bauthian"},
		{"Par Mathieu Bablet", "Mathieu Bablet"},
		{"Christian de Metter", "Christian de Metter"},
		{"Faustin de Ravignan", "Faustin de Ravignan"},
	}
	for _, tc := range cases {
		if got := scrapers.CleanAuthorName(tc[0]); got != tc[1] {
			t.Errorf("CleanAuthorName(%q) = %q, want %q", tc[0], got, tc[1])
		}
	}
}

func TestSplitAuthorName(t *testing.T) {
	cases := []struct {
		input     string
		firstname string
		lastname  string
	}{
		{"Auteur + illustrateurMathieu Bablet", "Mathieu", "Bablet"},
		{"Mathieu Bablet", "Mathieu", "Bablet"},
		{"RUN", "", "RUN"},
		{"Scénariste et dessinateurRun", "", "Run"},
		{"Florence Dupré la Tour", "Florence", "Dupré la Tour"},
		{"", "", ""},
	}
	for _, tc := range cases {
		f, l := scrapers.SplitAuthorName(tc.input)
		if f != tc.firstname || l != tc.lastname {
			t.Errorf("SplitAuthorName(%q) = (%q, %q), want (%q, %q)", tc.input, f, l, tc.firstname, tc.lastname)
		}
	}
}

func TestVariantUtilities(t *testing.T) {
	if got := scrapers.StripVariantSuffix("X-Men - Shadows of Tomorrow N°06 - Edition collector"); got != "X-Men - Shadows of Tomorrow N°06" {
		t.Errorf("got %q", got)
	}
	if got := scrapers.StripVariantSuffix("Spider-Man Tome 1 (Variant site)"); got != "Spider-Man Tome 1" {
		t.Errorf("got %q", got)
	}
	if got := scrapers.StripVariantSuffix("Batman T01 Édition Prestige"); got != "Batman T01" {
		t.Errorf("got %q", got)
	}
	if got := scrapers.StripVariantSuffix("Regular Book"); got != "Regular Book" {
		t.Errorf("got %q", got)
	}

	s, v := scrapers.ExtractCanonicalSeriesAndVolume("X-Men - Shadows of Tomorrow N°06 - Edition collector")
	if s != "X-Men - Shadows of Tomorrow" || v == nil || *v != 6 {
		t.Errorf("got (%q, %v)", s, v)
	}

	s, v = scrapers.ExtractCanonicalSeriesAndVolume("X-Men (2026) N° 01")
	if s != "X-Men (2026)" || v == nil || *v != 1 {
		t.Errorf("got (%q, %v)", s, v)
	}

	s, v = scrapers.ExtractCanonicalSeriesAndVolume("Ultimate Spider-Man Tome 3")
	if s != "Ultimate Spider-Man" || v == nil || *v != 3 {
		t.Errorf("got (%q, %v)", s, v)
	}

	s, v = scrapers.ExtractCanonicalSeriesAndVolume("Civil War")
	if s != "Civil War" || v != nil {
		t.Errorf("got (%q, %v)", s, v)
	}

	if !scrapers.IsVariantBook("X-Men N°01 - Edition collector", "", "") {
		t.Errorf("expected variant book")
	}
	if !scrapers.IsVariantBook("X-Men N°01", "https://panini.fr/fxm26014v_0.jpg", "FXM26014_FR02") {
		t.Errorf("expected variant book by cover url")
	}
	if !scrapers.IsVariantBook("X-Men N°01", "https://panini.fr/fxm26014_0.jpg", "FXM26014V_FR02") {
		t.Errorf("expected variant book by sku")
	}
	if scrapers.IsVariantBook("Star Wars Tome 02", "https://panini.fr/fsw26002_0.jpg", "FSW26002_FR02") {
		t.Errorf("expected non-variant book")
	}
}

func TestMonsieurToussaintLouvertureSeriesAndVolume(t *testing.T) {
	s1, v1 := scrapers.ParseMTLSeriesAndVolume("Blackwater I, La Crue – L’épique saga de la famille Caskey")
	if s1 != "Blackwater" || v1 == nil || *v1 != 1 {
		t.Errorf("got (%q, %v)", s1, v1)
	}

	s2, v2 := scrapers.ParseMTLSeriesAndVolume("Blackwater IV, La Guerre – L’épique saga de la famille Caskey")
	if s2 != "Blackwater" || v2 == nil || *v2 != 4 {
		t.Errorf("got (%q, %v)", s2, v2)
	}

	s3, v3 := scrapers.ParseMTLSeriesAndVolume("L’Heure du loup – Volume 1")
	if s3 != "L’Heure du loup" || v3 == nil || *v3 != 1 {
		t.Errorf("got (%q, %v)", s3, v3)
	}

	s4, v4 := scrapers.ParseMTLSeriesAndVolume("MIND MGMT – Rapport d’opérations 2/3")
	if s4 != "MIND MGMT" || v4 == nil || *v4 != 2 {
		t.Errorf("got (%q, %v)", s4, v4)
	}

	s5, v5 := scrapers.ParseMTLSeriesAndVolume("Moi, ce que j’aime, c’est les monstres – Livre deuxième")
	if s5 != "Moi, ce que j’aime, c’est les monstres" || v5 == nil || *v5 != 2 {
		t.Errorf("got (%q, %v)", s5, v5)
	}

	s6, v6 := scrapers.ParseMTLSeriesAndVolume("Les Élémentaires")
	if s6 != "Les Élémentaires" || v6 != nil {
		t.Errorf("got (%q, %v)", s6, v6)
	}
}

func TestMonsieurToussaintLouvertureExclusionKeywords(t *testing.T) {
	containsAny := func(text string, kw []string) bool {
		low := strings.ToLower(text)
		for _, k := range kw {
			if strings.Contains(low, k) {
				return true
			}
		}
		return false
	}

	if !containsAny("sérigraphie blackwater", scrapers.ObjetKeywords) {
		t.Errorf("expected exclusion for sérigraphie")
	}
	if !containsAny("lot de 3 carnets du blackwater fishing club", scrapers.ObjetKeywords) {
		t.Errorf("expected exclusion for lot de 3 carnets")
	}
	if !containsAny("coffret l’heure du loup (vide)", scrapers.ObjetKeywords) {
		t.Errorf("expected exclusion for coffret")
	}
	if !containsAny("tasse blackwater fishing club", scrapers.ObjetKeywords) {
		t.Errorf("expected exclusion for tasse")
	}
	if !containsAny("swan song t1 – le feu et la glace / epub", scrapers.EpubKeywords) {
		t.Errorf("expected exclusion for epub")
	}

	if containsAny("les élémentaires", scrapers.ObjetKeywords) {
		t.Errorf("unexpected exclusion")
	}
	if containsAny("blackwater édition intégrale", scrapers.ObjetKeywords) {
		t.Errorf("unexpected exclusion")
	}
	if containsAny("l’heure du loup – volume 1", scrapers.ObjetKeywords) {
		t.Errorf("unexpected exclusion")
	}
}

func TestUrbanComicsParseAuthors(t *testing.T) {
	html := `
	<h5 class="authors">
		scénariste : <a href="/mattson-tomlin/">Mattson  Tomlin</a><br/>
		dessinateur : <a href="/bermejo-lee/">Lee Bermejo</a><br/>
		traducteur : <a href="/yann-graf/">Yann Graf</a>
	</h5>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	authors := scrapers.ParseAuthors(doc)
	if len(authors) != 3 {
		t.Fatalf("got %d authors, want 3", len(authors))
	}
	if authors[0].Firstname != "Mattson" || authors[0].Lastname != "Tomlin" || authors[0].Role != "Writer" {
		t.Errorf("unexpected author[0]: %+v", authors[0])
	}
	if authors[1].Firstname != "Lee" || authors[1].Lastname != "Bermejo" || authors[1].Role != "Illustrator" {
		t.Errorf("unexpected author[1]: %+v", authors[1])
	}
	if authors[2].Firstname != "Yann" || authors[2].Lastname != "Graf" || authors[2].Role != "Translator" {
		t.Errorf("unexpected author[2]: %+v", authors[2])
	}
}

func TestUrbanComicsParseAuthorsFiltersNavigationLinks(t *testing.T) {
	html := `
	<h5 class="authors">
		<a href="/category/auteurs/interviews/">Interviews</a>
		<a href="/category/auteurs/portfolio-2/">Portfolio</a>
		scénariste : <a href="/rick-remender/">Rick REMENDER</a>
	</h5>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	authors := scrapers.ParseAuthors(doc)
	if len(authors) != 1 {
		t.Fatalf("got %d authors, want 1", len(authors))
	}
	if authors[0].Firstname != "Rick" || authors[0].Lastname != "Remender" || authors[0].Role != "Writer" {
		t.Errorf("unexpected author[0]: %+v", authors[0])
	}
}

func TestUrbanComicsParseSeriesAndVolume(t *testing.T) {
	html := `
	<div class="eightcol first">
		<h1 id="titre-album">A Vicious Circle tome 1</h1>
		<div class="serie_album">Série : <a href="/a-vicious-circle-serie/">A Vicious Circle</a></div>
	</div>`
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		t.Fatal(err)
	}
	series, vol := scrapers.ParseSeriesAndVolume("A Vicious Circle tome 1", doc)
	if series != "A Vicious Circle" || vol == nil || *vol != 1 {
		t.Errorf("got (%q, %v), want ('A Vicious Circle', 1)", series, vol)
	}
}

func TestMangetsuPagination(t *testing.T) {
	htmlPage1 := `
	<div class="pagination">
		<nav>
			<span class="disabled">Previous</span>
			<span class="current">1</span>
			<a href="/catalogue/?page=2">2</a>
			<a href="/catalogue/?page=33">33</a>
			<a href="/catalogue/?page=2" rel="next">Next</a>
		</nav>
	</div>`
	scraper := scrapers.NewMangetsuScraper()
	doc1, _ := goquery.NewDocumentFromReader(strings.NewReader(htmlPage1))
	nextURL := scraper.ExtractNextPageURL(doc1, "https://mangetsu-manga.fr/catalogue/", "https://mangetsu-manga.fr", map[string]bool{})
	if nextURL != "https://mangetsu-manga.fr/catalogue/?page=2" {
		t.Errorf("got %q, want %q", nextURL, "https://mangetsu-manga.fr/catalogue/?page=2")
	}

	htmlLast := `
	<div class="pagination">
		<nav>
			<a href="/catalogue/?page=32" rel="prev">Previous</a>
			<a href="/catalogue/?page=1">1</a>
			<span class="current">33</span>
			<span class="disabled">Next</a>
		</nav>
	</div>`
	docLast, _ := goquery.NewDocumentFromReader(strings.NewReader(htmlLast))
	nextURLLast := scraper.ExtractNextPageURL(docLast, "https://mangetsu-manga.fr/catalogue/?page=33", "https://mangetsu-manga.fr", map[string]bool{})
	if nextURLLast != "" {
		t.Errorf("expected empty next URL on last page, got %q", nextURLLast)
	}

	htmlNoPagi := `<div><p>Pas de pagination ici</p></div>`
	docNoPagi, _ := goquery.NewDocumentFromReader(strings.NewReader(htmlNoPagi))
	nextURLNone := scraper.ExtractNextPageURL(docNoPagi, "https://mangetsu-manga.fr/a-paraitre/", "https://mangetsu-manga.fr", map[string]bool{})
	if nextURLNone != "" {
		t.Errorf("expected empty next URL when absent, got %q", nextURLNone)
	}
}

func TestPaniniComicsCatalogURLs(t *testing.T) {
	expected := []string{
		"https://www.panini.fr/shp_fra_fr/comics/marvel.html",
		"https://www.panini.fr/shp_fra_fr/comics/star-wars.html",
		"https://www.panini.fr/shp_fra_fr/comics/disney.html",
		"https://www.panini.fr/shp_fra_fr/comics/autres-comics.html",
	}
	if !reflect.DeepEqual(scrapers.PaniniCatalogURLs, expected) {
		t.Errorf("got %v, want %v", scrapers.PaniniCatalogURLs, expected)
	}
}

func TestPaniniComicsPagination(t *testing.T) {
	htmlPage1 := `
	<div class="pages">
		<strong class="label pages-label" id="paging-label">Page</strong>
		<ul class="items pages-items" aria-labelledby="paging-label">
			<li class="item current">
				<strong class="page">
					<span class="label">Vous lisez actuellement la page</span>
					<span>1</span>
				</strong>
			</li>
			<li class="item">
				<a class="page" href="https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2&amp;pnn_is_not_presale=En+vente&amp;pnn_is_saleable=1">
					<span class="label">Page</span>
					<span>2</span>
				</a>
			</li>
			<li class="item pages-item-next">
				<a class="action next" href="https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2&amp;pnn_is_not_presale=En+vente&amp;pnn_is_saleable=1" title="Suivant">
					<span class="label">Page</span>
					<span>Suivant</span>
				</a>
			</li>
		</ul>
	</div>`
	doc1, _ := goquery.NewDocumentFromReader(strings.NewReader(htmlPage1))
	nextURL := scrapers.ExtractPaniniNextPageURL(doc1, "https://www.panini.fr/shp_fra_fr/comics/disney.html")
	if nextURL != "https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2&pnn_is_not_presale=En+vente&pnn_is_saleable=1" {
		t.Errorf("got %q", nextURL)
	}

	htmlLast := `
	<div class="pages">
		<strong class="label pages-label" id="paging-label">Page</strong>
		<ul class="items pages-items" aria-labelledby="paging-label">
			<li class="item pages-item-previous">
				<a class="action previous" href="https://www.panini.fr/shp_fra_fr/comics/disney.html?pnn_is_not_presale=En+vente&amp;pnn_is_saleable=1" title="Précédent">
					<span class="label">Page</span>
					<span>Précédent</span>
				</a>
			</li>
			<li class="item current">
				<strong class="page">
					<span class="label">Vous lisez actuellement la page</span>
					<span>2</span>
				</strong>
			</li>
		</ul>
	</div>`
	docLast, _ := goquery.NewDocumentFromReader(strings.NewReader(htmlLast))
	if got := scrapers.ExtractPaniniNextPageURL(docLast, "https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2"); got != "" {
		t.Errorf("expected empty next URL, got %q", got)
	}
}

func TestPaniniComicsParseCard(t *testing.T) {
	html := `
	<ul>
	<li class="item product product-item">
		<div class="product-item-info">
			<div class="product photo product-item-photo">
				<a class="product link product-item-link" href="https://www.panini.fr/shp_fra_fr/star-wars-tome-02-fsw26002-fr02.html">
					<img class="product-image-photo" src="https://www.panini.fr/media/catalog/product/f/s/fsw26002_0.jpg?quality=80" alt="Star Wars Tome 02"/>
				</a>
			</div>
			<div class="product details product-item-details">
				<h3 class="product name product-item-name">
					<a class="product-item-link" href="https://www.panini.fr/shp_fra_fr/star-wars-tome-02-fsw26002-fr02.html">
						Star Wars Tome 02
					</a>
				</h3>
				<div class="product attributes product-item-attributes">
					<div class="product attribute type product-item-attribute-release-date">
						<small>20/10/26</small>
					</div>
				</div>
				<div class="price-box price-final_price">
					<span class="price-wrapper">
						<span class="price">16,99 €</span>
					</span>
				</div>
				<form data-product-sku="9782809499999"></form>
			</div>
		</div>
	</li>
	</ul>`
	doc, _ := goquery.NewDocumentFromReader(strings.NewReader(html))
	card := doc.Find("li.item.product.product-item").First()
	scraper := scrapers.NewPaniniComicsScraper()
	book := scraper.ParseCard(card, "https://www.panini.fr/shp_fra_fr/comics/star-wars.html")
	if book == nil {
		t.Fatal("expected non-nil book")
	}
	if book.Title != "Star Wars Tome 02" || book.SeriesName != "Star Wars" {
		t.Errorf("unexpected title/series: %+v", book)
	}
	if book.Volume == nil || *book.Volume != 2 {
		t.Errorf("unexpected volume: %v", book.Volume)
	}
	if book.Price != 16 {
		t.Errorf("unexpected price: %v", book.Price)
	}
	if book.EditorName != "Panini Comics" || book.CategoryName != "Comics" {
		t.Errorf("unexpected editor/category: %+v", book)
	}
	if book.CoverURL != "https://www.panini.fr/media/catalog/product/f/s/fsw26002_0.jpg" {
		t.Errorf("unexpected cover url: %q", book.CoverURL)
	}
	if book.ISBN != "9782809499999" {
		t.Errorf("unexpected isbn: %q", book.ISBN)
	}
	if book.ReleaseDate == nil || book.ReleaseDate.Year() != 2026 || int(book.ReleaseDate.Month()) != 10 || book.ReleaseDate.Day() != 20 {
		t.Errorf("unexpected release date: %v", book.ReleaseDate)
	}
	if book.IsVariant {
		t.Errorf("expected IsVariant = false")
	}
}

func TestPaniniComicsParseVariantCard(t *testing.T) {
	html := `
	<ul>
	<li class="item product product-item">
		<div class="product-item-info">
			<div class="product photo product-item-photo">
				<a class="product link product-item-link" href="https://www.panini.fr/shp_fra_fr/x-men-shadows-of-tomorrow-n-06-edition-collector-fxm26014v-fr02.html">
					<img class="product-image-photo" src="https://www.panini.fr/media/catalog/product/f/x/fxm26014v_0.jpg?quality=80" alt="X-Men - Shadows of Tomorrow N°06"/>
				</a>
			</div>
			<div class="product details product-item-details">
				<h3 class="product name product-item-name">
					<a class="product-item-link" href="https://www.panini.fr/shp_fra_fr/x-men-shadows-of-tomorrow-n-06-edition-collector-fxm26014v-fr02.html">
						X-Men - Shadows of Tomorrow N°06
					</a>
				</h3>
				<div class="product attributes product-item-attributes">
					<div class="product attribute type product-item-attribute-release-date">
						<small>21/10/26</small>
					</div>
				</div>
				<div class="price-box price-final_price">
					<span class="price-wrapper">
						<span class="price">20,99 €</span>
					</span>
				</div>
				<form data-product-sku="FXM26014V_FR02"></form>
			</div>
		</div>
	</li>
	</ul>`
	doc, _ := goquery.NewDocumentFromReader(strings.NewReader(html))
	card := doc.Find("li.item.product.product-item").First()
	scraper := scrapers.NewPaniniComicsScraper()
	book := scraper.ParseCard(card, "https://www.panini.fr/shp_fra_fr/comics/marvel.html")
	if book == nil {
		t.Fatal("expected non-nil book")
	}
	if !book.IsVariant {
		t.Errorf("expected IsVariant = true")
	}
	if book.Title != "X-Men - Shadows of Tomorrow N°06 - Edition collector" {
		t.Errorf("got title %q", book.Title)
	}
	if book.SeriesName != "X-Men - Shadows of Tomorrow" {
		t.Errorf("got series %q", book.SeriesName)
	}
	if book.Volume == nil || *book.Volume != 6 {
		t.Errorf("got volume %v", book.Volume)
	}
	if book.Price != 20 {
		t.Errorf("got price %v", book.Price)
	}
}
