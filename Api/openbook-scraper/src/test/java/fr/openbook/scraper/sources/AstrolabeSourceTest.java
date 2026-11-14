package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScrapedAuthorDTO;
import fr.openbook.scraper.model.ScrapedBookDTO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AstrolabeSourceTest {

    private AstrolabeSource source;

    @BeforeEach
    void setUp() {
        ScraperProperties properties = new ScraperProperties();
        properties.setRequestTimeout(30);
        source = new AstrolabeSource(properties);
    }

    @Test
    void testMetadata() {
        assertEquals("astrolabe", source.getId());
        assertEquals("Astrolabe", source.getName());
        assertEquals("#14b8a6", source.getColor());
        assertNotNull(source.getDescription());
    }

    @Test
    void testParseCard() {
        String html = """
            <article class="card-product">
              <picture class="card-product__media">
                <img loading="lazy" itemprop="image" src="//leslibraires.b-cdn.net/vxXZ3gTJ3yFRQbJQZbWAslNat0mTe6T6qfz4MVTmvk8/s:302:204/MTU4NjMwMTE.webp" alt="1, Pourpre-Sang tome 1 : Le Cercle de Nimuée">
              </picture>
              <div class="card-product__details">
                <div class="card-product__info">
                  <h3 class="card-product__title">
                    <a href="/livre/26342304-1-pourpre-sang-tome-1-le-cercle-de-nimuee-leo-cherel-astrolabe" class="stretched-link">1, Pourpre-Sang tome 1 : Le Cercle de Nimuée</a>
                  </h3>
                  <span class="card-product__author" itemprop="author">Leo CHEREL</span>
                  <span class="card-product__edition" itemprop="publisher">ASTROLABE</span>
                </div>
                <div class="card-product__offers">
                  <div class="price-wrapper"><div class="product-price">21,90&nbsp;€</div></div>
                  <div class="product-stock"><span class="product-stock--short"></span> En stock</div>
                </div>
              </div>
            </article>
        """;

        Document doc = Jsoup.parse(html, AstrolabeSource.CATALOG_URL);
        Element card = doc.selectFirst("article.card-product");
        AstrolabeSource.CardHint hint = source.parseCard(card, AstrolabeSource.CATALOG_URL);

        assertNotNull(hint);
        assertEquals("https://www.leslibraires.fr/livre/26342304-1-pourpre-sang-tome-1-le-cercle-de-nimuee-leo-cherel-astrolabe", hint.url());
        assertEquals("Pourpre-Sang tome 1 : Le Cercle de Nimuée", hint.title());
        assertEquals(1, hint.volumeHint());
        assertEquals("Leo CHEREL", hint.authorRaw());
        assertEquals(22, hint.price());
        assertEquals("https://leslibraires.b-cdn.net/vxXZ3gTJ3yFRQbJQZbWAslNat0mTe6T6qfz4MVTmvk8/s:302:204/MTU4NjMwMTE.webp", hint.coverUrl());
    }

    @Test
    void testParseCardPlaceholderCoverIgnored() {
        String html = """
            <article class="card-product">
              <picture class="card-product__media">
                <img loading="lazy" itemprop="image" src="//static.leslibraires.fr//websites/design_2024/static/assets/icons/default/book.avif" alt="Le Dernier Pilote- Edition N&amp;B">
              </picture>
              <div class="card-product__details">
                <div class="card-product__info">
                  <h3 class="card-product__title">
                    <a href="/livre/26623888-le-dernier-pilote--edition-n-b-murphy-astrolabe" class="stretched-link">Le Dernier Pilote- Edition N&amp;B</a>
                  </h3>
                  <span class="card-product__author" itemprop="author">MURPHY</span>
                </div>
                <div class="card-product__offers">
                  <div class="price-wrapper"><div class="product-price">29&nbsp;€</div></div>
                </div>
              </div>
            </article>
        """;

        Document doc = Jsoup.parse(html, AstrolabeSource.CATALOG_URL);
        AstrolabeSource.CardHint hint = source.parseCard(doc.selectFirst("article.card-product"), AstrolabeSource.CATALOG_URL);

        assertNotNull(hint);
        assertNull(hint.coverUrl());
        assertEquals(29, hint.price());
    }

    @Test
    void testParseBookDocumentWithSeriesCollectionAndAuthors() {
        String html = """
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="/rayon/bd-comics-mangas/">BD, Comics &amp; Manga</a></li>
                <li class="breadcrumb-item"><a href="/rayon/bandes-dessinees/">Bandes dessinées</a></li>
              </ol>
            </nav>
            <section itemscope itemtype="https://schema.org/Product https://schema.org/Book">
              <meta itemprop="gtin13" content="9782488807067">
              <div class="product-media">
                <div class="product-images">
                  <div class="product-image" data-src="//leslibraires.b-cdn.net/lr1ZP5wxQvymdUz_ZSt6pqIhvqg3o99d7s0xAvfSTDM/s:800:800/MTU4NjMwMTE.webp">
                    <img itemprop="image" src="//leslibraires.b-cdn.net/lr1ZP5wxQvymdUz_ZSt6pqIhvqg3o99d7s0xAvfSTDM/s:800:800/MTU4NjMwMTE.webp">
                  </div>
                </div>
              </div>
              <article class="product-features">
                <table class="table">
                  <tbody>
                    <tr><th scope="row">Format</th><td>Relié</td></tr>
                    <tr><th scope="row">EAN13</th><td itemprop="gtin13">9782488807067</td></tr>
                    <tr><th scope="row">Date de publication</th><td itemprop="datePublished" datetime="2026-05-07">7 mai 2026</td></tr>
                    <tr><th scope="row">Collection</th><td><a href="/editeur/astrolabe/collection/charybde/">Charybde</a></td></tr>
                    <tr><th scope="row">Série</th><td><a href="/serie/pourpre-sang/99175/">Pourpre-Sang</a> (1)</td></tr>
                    <tr><th scope="row">Nombre de pages</th><td itemprop="numberOfPages">112</td></tr>
                  </tbody>
                </table>
              </article>
              <div class="product-details">
                <h1 class="product-details__title" itemprop="name">
                  <a href="#">Pourpre-Sang</a>
                  1 - Pourpre-Sang tome 1 : Le Cercle de Nimuée
                </h1>
                <h2 class="product-details__author" itemprop="author">Leo CHEREL</h2>
              </div>
              <article class="product-description">
                <div class="inside">
                  <p itemprop="description">L'ordre des Pourpres-Sangs a juré de protéger les plus démunis.</p>
                </div>
              </article>
              <div class="price-wrapper">
                <meta itemprop="price" content="21.90"/>
                <div class="product-price">21,90 €</div>
              </div>
            </section>
        """;

        String url = "https://www.leslibraires.fr/livre/26342304-1-pourpre-sang-tome-1-le-cercle-de-nimuee-leo-cherel-astrolabe";
        Document doc = Jsoup.parse(html, url);
        ScrapedBookDTO book = source.parseBookDocument(doc, url, null);

        assertNotNull(book);
        assertEquals("Pourpre-Sang tome 1 : Le Cercle de Nimuée", book.getTitle());
        assertEquals("Pourpre-Sang", book.getSeriesName());
        assertEquals(1, book.getVolume());
        assertEquals("9782488807067", book.getIsbn());
        assertEquals("Astrolabe", book.getEditorName());
        assertEquals("Charybde", book.getCollectionName());
        assertEquals("Bande dessinée", book.getCategoryName());
        assertEquals("Cartonné", book.getBookType());
        assertEquals(112, book.getPageCount());
        assertEquals(22, book.getPrice());
        assertEquals(LocalDate.of(2026, 5, 7), book.getReleaseDate());
        assertEquals("https://leslibraires.b-cdn.net/lr1ZP5wxQvymdUz_ZSt6pqIhvqg3o99d7s0xAvfSTDM/s:800:800/MTU4NjMwMTE.webp", book.getCoverUrl());
        assertEquals(1, book.getAuthors().size());
        assertEquals("Leo", book.getAuthors().get(0).getFirstname());
        assertEquals("Cherel", book.getAuthors().get(0).getLastname());
    }

    @Test
    void testAuthorNormalizationAndDeduplication() {
        String html = """
            <div class="product-details">
              <h2 class="product-details__author" itemprop="author">SCALERA  Matteo</h2>
              <h2 class="product-details__author">Illustrations de <a href="/personne/matteo-scalera/1941090/" itemprop="author" class="link">Matteo Scalera</a></h2>
            </div>
        """;
        Document doc = Jsoup.parse(html);
        AstrolabeSource.CardHint hint = new AstrolabeSource.CardHint("https://example.com", "Le Quatrième Père tome 1", 1, "Matteo Scalera", "Astrolabe", 23, null);
        List<ScrapedAuthorDTO> authors = AstrolabeSource.parseAuthors(doc, hint);

        assertEquals(1, authors.size());
        assertEquals("Matteo", authors.get(0).getFirstname());
        assertEquals("Scalera", authors.get(0).getLastname());

        // Test slash-separated authors with Roman numeral suffix
        Document doc2 = Jsoup.parse("<div class='product-details'><h2 class='product-details__author'>Tynion Iv/Lehman</h2></div>");
        List<ScrapedAuthorDTO> authors2 = AstrolabeSource.parseAuthors(doc2, null);
        assertEquals(2, authors2.size());
        assertEquals("", authors2.get(0).getFirstname());
        assertEquals("Tynion IV", authors2.get(0).getLastname());
        assertEquals("", authors2.get(1).getFirstname());
        assertEquals("Lehman", authors2.get(1).getLastname());
    }

    @Test
    void testExtractNextPageUrl() {
        String html = """
            <nav aria-label="Voir plus d'articles" class="pagination">
              <div>Vous avez vu 12 articles sur 25</div>
              <a class="btn btn-primary" href="?page=2">Voir plus</a>
            </nav>
        """;
        Document doc = Jsoup.parse(html, AstrolabeSource.CATALOG_URL);
        String next = AstrolabeSource.extractNextPageUrl(doc, AstrolabeSource.CATALOG_URL);
        assertEquals("https://www.leslibraires.fr/editeur/astrolabe/?page=2", next);
    }

    @Test
    void testLiveScrapeBookPageLePhare() {
        ScrapedBookDTO book = source.scrapeBookPage("https://www.leslibraires.fr/livre/26623351-le-phare-tynion-iv-lehman-astrolabe");
        assertNotNull(book);
        assertEquals("Le Phare", book.getTitle());
        assertEquals("Astrolabe", book.getEditorName());
        assertEquals("9782488807012", book.getIsbn());
        assertEquals(96, book.getPageCount());
        assertEquals(23, book.getPrice());
        assertEquals(LocalDate.of(2026, 10, 16), book.getReleaseDate());
        assertFalse(book.getAuthors().isEmpty());
        assertNotNull(book.getCoverUrl());
        assertTrue(book.getCoverUrl().startsWith("https://leslibraires.b-cdn.net/"));
    }
}
