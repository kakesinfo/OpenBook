package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScanOptions;
import fr.openbook.scraper.model.ScrapedBookDTO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LesLibrairesSourcesTest {

    private ScraperProperties properties;

    @BeforeEach
    void setUp() {
        properties = new ScraperProperties();
        properties.setRequestTimeout(30);
    }

    @Test
    void testAllSourcesMetadata() {
        HautevilleSource hauteville = new HautevilleSource(properties);
        assertEquals("hauteville", hauteville.getId());
        assertEquals("Hauteville", hauteville.getName());
        assertNull(hauteville.getPersonId());
        assertEquals("Hauteville", hauteville.getDefaultEditorName());

        AgathaChristieSource agatha = new AgathaChristieSource(properties);
        assertEquals("agatha_christie", agatha.getId());
        assertEquals("Agatha Christie", agatha.getName());
        assertEquals("58189", agatha.getPersonId());
        assertNull(agatha.getDefaultEditorName());

        AliHazelwoodSource ali = new AliHazelwoodSource(properties);
        assertEquals("ali_hazelwood", ali.getId());
        assertEquals("Ali Hazelwood", ali.getName());
        assertEquals("2346681", ali.getPersonId());

        SarahJMaasSource sarah = new SarahJMaasSource(properties);
        assertEquals("sarah_j_maas", sarah.getId());
        assertEquals("Sarah J. Maas", sarah.getName());
        assertEquals("1805611", sarah.getPersonId());

        JaneAustenSource jane = new JaneAustenSource(properties);
        assertEquals("jane_austen", jane.getId());
        assertEquals("Jane Austen", jane.getName());
        assertEquals("51020", jane.getPersonId());

        CarlosRuizZafonSource carlos = new CarlosRuizZafonSource(properties);
        assertEquals("carlos_ruiz_zafon", carlos.getId());
        assertEquals("Carlos Ruiz Zafón", carlos.getName());
        assertEquals("1720863", carlos.getPersonId());

        MichaelMcDowellSource mcdowell = new MichaelMcDowellSource(properties);
        assertEquals("michael_mcdowell", mcdowell.getId());
        assertEquals("Michael McDowell", mcdowell.getName());
        assertEquals("217934", mcdowell.getPersonId());
    }

    @Test
    void testHtmxPaginationParsing() {
        String html = """
            <nav aria-label="Voir plus d'articles" class="pagination">
              <div>Vous avez vu 12 articles sur 45</div>
              <button class='btn btn-primary' hx-get="/htmx/contributions/"
                      hx-target="closest nav" hx-swap="outerHTML"
                      hx-vals='{"personID": "2346681", "contributionType": "By(author)", "page": "2"}'>
                Voir plus
              </button>
            </nav>
        """;
        Document doc = Jsoup.parse(html, AbstractLesLibrairesSource.BASE_URL);
        String nextUrl = AbstractLesLibrairesSource.extractNextPageUrl(doc, AbstractLesLibrairesSource.BASE_URL);
        assertEquals("https://www.leslibraires.fr/htmx/contributions/?personID=2346681&contributionType=By%28author%29&page=2", nextUrl);
    }

    @Test
    void testParseCardSkipsEbookAndExtractsEditor() {
        AliHazelwoodSource ali = new AliHazelwoodSource(properties);

        String ebookHtml = """
            <article class="card-product">
              <h3 class="card-product__title"><a href="/ebook/9782387216274/deep-end">Deep End</a></h3>
            </article>
        """;
        Document ebookDoc = Jsoup.parse(ebookHtml, AbstractLesLibrairesSource.BASE_URL);
        assertNull(ali.parseCard(ebookDoc.selectFirst("article.card-product"), AbstractLesLibrairesSource.BASE_URL));

        String bookHtml = """
            <article class="card-product">
              <div class="card-product__info">
                <h3 class="card-product__title"><a href="/livre/26145807-deep-end-ali-hazelwood-hauteville">Deep End</a></h3>
                <span class="card-product__author">Ali Hazelwood</span>
                <span class="card-product__edition">Hauteville</span>
              </div>
              <div class="price-wrapper"><div class="product-price">19,95 €</div></div>
            </article>
        """;
        Document bookDoc = Jsoup.parse(bookHtml, AbstractLesLibrairesSource.BASE_URL);
        AbstractLesLibrairesSource.CardHint hint = ali.parseCard(bookDoc.selectFirst("article.card-product"), AbstractLesLibrairesSource.BASE_URL);
        assertNotNull(hint);
        assertEquals("Hauteville", hint.editorRaw());
        assertEquals(20, hint.price());
    }

    @Test
    void testParseNovelBookDocumentExtractsDynamicEditorAndRomanCategory() {
        AliHazelwoodSource ali = new AliHazelwoodSource(properties);
        String html = """
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="/rayon/romance/">Romance</a></li>
              </ol>
            </nav>
            <section>
              <meta itemprop="gtin13" content="9782387210678">
              <article class="product-features">
                <table class="table">
                  <tr><th>Format</th><td>Broché</td></tr>
                  <tr><th>Éditeur</th><td itemprop="publisher"><a href="/editeur/hauteville/">Hauteville</a></td></tr>
                  <tr><th>Date de publication</th><td itemprop="datePublished" datetime="2026-04-01">1 avril 2026</td></tr>
                  <tr><th>Collection</th><td><a href="/editeur/hauteville/collection/hauteville-comr/">Hauteville Comrom</a></td></tr>
                  <tr><th>Nombre de pages</th><td itemprop="numberOfPages">544</td></tr>
                </table>
              </article>
              <div class="product-details">
                <h1 class="product-details__title" itemprop="name">Deep End</h1>
                <h2 class="product-details__author">De <a href="/personne/ali-hazelwood/2346681/" itemprop="author">Ali Hazelwood</a></h2>
                <p class="product-details__author">Traduit par <a href="/personne/joelle-touati/630659/" itemprop="author">Joëlle Touati</a></p>
                <div class="product-details__similar">
                  <h3 class="product-details__editions">Éditeur <a href="/editeur/hauteville/" itemprop="publisher">Hauteville</a></h3>
                </div>
              </div>
              <div class="price-wrapper"><meta itemprop="price" content="19.95"/></div>
            </section>
        """;
        String url = "https://www.leslibraires.fr/livre/26145807-deep-end-ali-hazelwood-hauteville";
        ScrapedBookDTO book = ali.parseBookDocument(Jsoup.parse(html, url), url, null);

        assertNotNull(book);
        assertEquals("Deep End", book.getTitle());
        assertEquals("Hauteville", book.getEditorName());
        assertEquals("Hauteville Comrom", book.getCollectionName());
        assertEquals("Roman", book.getCategoryName());
        assertEquals("Broché", book.getBookType());
        assertEquals(544, book.getPageCount());
        assertEquals(20, book.getPrice());
        assertEquals(LocalDate.of(2026, 4, 1), book.getReleaseDate());
        assertEquals(1, book.getAuthors().size());
        assertEquals("Ali", book.getAuthors().get(0).getFirstname());
        assertEquals("Hazelwood", book.getAuthors().get(0).getLastname());
    }

    @Test
    void testLiveScrapeDeepEnd() {
        AliHazelwoodSource ali = new AliHazelwoodSource(properties);
        ScrapedBookDTO book = ali.scrapeBookPage("https://www.leslibraires.fr/livre/26145807-deep-end-ali-hazelwood-hauteville");
        assertNotNull(book);
        assertEquals("Deep End", book.getTitle());
        assertEquals("9782387210678", book.getIsbn());
        assertEquals("Hauteville", book.getEditorName());
        assertEquals("Roman", book.getCategoryName());
        assertFalse(book.getAuthors().isEmpty());
    }

    @Test
    void testLiveScrapeAgathaChristieAndSarahJMaas() {
        AgathaChristieSource agatha = new AgathaChristieSource(properties);
        List<ScrapedBookDTO> agathaBooks = agatha.scrape(new ScanOptions(false, 2), null, () -> false);
        assertFalse(agathaBooks.isEmpty(), "Agatha Christie should return books");
        assertFalse(agathaBooks.get(0).getTitle().isBlank());

        SarahJMaasSource sarah = new SarahJMaasSource(properties);
        List<ScrapedBookDTO> sarahBooks = sarah.scrape(new ScanOptions(false, 2), null, () -> false);
        assertFalse(sarahBooks.isEmpty(), "Sarah J. Maas should return books");
        assertFalse(sarahBooks.get(0).getTitle().isBlank());
    }

    @Test
    void testComicsAndPublisherSourcesMetadataAndTriNouveautes() {
        AstrolabeSource astrolabe = new AstrolabeSource(properties);
        assertTrue(astrolabe.getSourceUrl().contains("tri=nouveautes"));

        HautevilleSource hauteville = new HautevilleSource(properties);
        assertTrue(hauteville.getSourceUrl().contains("tri=nouveautes"));

        assertTrue(Label619Source.LESLIBRAIRES_URL.contains("tri=nouveautes"));
        assertTrue(MorgenBdSource.LESLIBRAIRES_URL.contains("tri=nouveautes"));

        HiComicsSource hicomics = new HiComicsSource(properties);
        assertEquals("hicomics", hicomics.getId());
        assertEquals("HiComics", hicomics.getName());
        assertEquals("HiComics", hicomics.getDefaultEditorName());
        assertEquals("Comics", hicomics.getDefaultCategoryName());
        assertTrue(hicomics.isForceDefaultCategory());
        assertTrue(hicomics.getSourceUrl().contains("tri=nouveautes"));

        Editions404GraphicSource ed404 = new Editions404GraphicSource(properties);
        assertEquals("404_graphic", ed404.getId());
        assertEquals("404 Graphic", ed404.getName());
        assertEquals("404 Graphic", ed404.getDefaultEditorName());
        assertEquals("Comics", ed404.getDefaultCategoryName());
        assertTrue(ed404.isForceDefaultCategory());
        assertTrue(ed404.getSourceUrl().contains("tri=nouveautes"));

        DelcourtComicsSource delcourt = new DelcourtComicsSource(properties);
        assertEquals("delcourt_comics", delcourt.getId());
        assertEquals("Delcourt Comics", delcourt.getName());
        assertEquals("Delcourt", delcourt.getDefaultEditorName());
        assertEquals("Comics", delcourt.getDefaultCategoryName());
        assertTrue(delcourt.isForceDefaultCategory());
        assertTrue(delcourt.getSourceUrl().contains("tri=nouveautes"));

        VestronSource vestron = new VestronSource(properties);
        assertEquals("vestron", vestron.getId());
        assertEquals("Vestron", vestron.getName());
        assertEquals("Vestron", vestron.getDefaultEditorName());
        assertEquals("Comics", vestron.getDefaultCategoryName());
        assertTrue(vestron.isForceDefaultCategory());
        assertTrue(vestron.getSourceUrl().contains("tri=nouveautes"));

        BlissSource bliss = new BlissSource(properties);
        assertEquals("bliss", bliss.getId());
        assertEquals("Bliss", bliss.getName());
        assertEquals("Bliss", bliss.getDefaultEditorName());
        assertEquals("Comics", bliss.getDefaultCategoryName());
        assertTrue(bliss.isForceDefaultCategory());
        assertTrue(bliss.getSourceUrl().contains("tri=nouveautes"));

        SolodoloSource solodolo = new SolodoloSource(properties);
        assertEquals("solodolo", solodolo.getId());
        assertEquals("Solodolo", solodolo.getName());
        assertEquals("Solodolo", solodolo.getDefaultEditorName());
        assertEquals("Comics", solodolo.getDefaultCategoryName());
        assertTrue(solodolo.isForceDefaultCategory());
        assertTrue(solodolo.getSourceUrl().contains("tri=nouveautes"));

        HuginnMuninnComicsSource huginn = new HuginnMuninnComicsSource(properties);
        assertEquals("huginn_muninn_comics", huginn.getId());
        assertEquals("Huginn & Muninn Comics", huginn.getName());
        assertNull(huginn.getDefaultEditorName());
        assertEquals("Comics", huginn.getDefaultCategoryName());
        assertTrue(huginn.isForceDefaultCategory());
        assertTrue(huginn.getSourceUrl().contains("tri=nouveautes"));

        String bdHtml = """
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="/rayon/bandes-dessinees/">Bandes dessinées</a></li>
              </ol>
            </nav>
            <section>
              <meta itemprop="gtin13" content="9782413000001">
              <div class="product-details">
                <h1 class="product-details__title" itemprop="name">Test Comics</h1>
              </div>
            </section>
        """;
        String bdUrl = "https://www.leslibraires.fr/livre/123456-test-comics";
        ScrapedBookDTO bdBook = delcourt.parseBookDocument(Jsoup.parse(bdHtml, bdUrl), bdUrl, null);
        assertNotNull(bdBook);
        assertEquals("Comics", bdBook.getCategoryName());
    }

    @Test
    void testLiveScrapeNewComicsSources() {
        DelcourtComicsSource delcourt = new DelcourtComicsSource(properties);
        List<ScrapedBookDTO> delcourtBooks = delcourt.scrape(new ScanOptions(false, 2), null, () -> false);
        assertFalse(delcourtBooks.isEmpty(), "Delcourt Comics should return books");
        assertEquals("Comics", delcourtBooks.get(0).getCategoryName());

        HiComicsSource hicomics = new HiComicsSource(properties);
        List<ScrapedBookDTO> hiBooks = hicomics.scrape(new ScanOptions(false, 2), null, () -> false);
        assertFalse(hiBooks.isEmpty(), "HiComics should return books");
        assertEquals("Comics", hiBooks.get(0).getCategoryName());

        Editions404GraphicSource ed404 = new Editions404GraphicSource(properties);
        List<ScrapedBookDTO> ed404Books = ed404.scrape(new ScanOptions(false, 2), null, () -> false);
        assertFalse(ed404Books.isEmpty(), "404 Graphic should return books");
        assertEquals("Comics", ed404Books.get(0).getCategoryName());
    }
}
