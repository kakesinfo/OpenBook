package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import fr.openbook.scraper.model.ScrapedBookDTO;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class PaniniComicsSourceTest {

    private PaniniComicsSource source;

    @BeforeEach
    void setUp() {
        ScraperProperties properties = new ScraperProperties();
        properties.setRequestTimeout(30);
        source = new PaniniComicsSource(properties);
    }

    @Test
    void testMetadata() {
        assertEquals("panini", source.getId());
        assertEquals("Panini Comics", source.getName());
        assertEquals("#ef4444", source.getColor());
    }

    @Test
    void testParseCard() {
        String html = """
            <article class="product-miniature js-product-miniature text-center" data-id-product="18717">
                <div class="thumbnail-container">
                    <div class="product-left">
                        <div class="product-image-container">
                            <a href="https://www.excalibur-comics.fr/panini-poche/18717-the-magic-order-tome-2-poche-9791070262764.html" class="thumbnail product-thumbnail">
                                <img src="https://www.excalibur-comics.fr/30174-home_default/the-magic-order-tome-2-poche.jpg"
                                     alt="The Magic Order Tome 2 - Poche"
                                     data-full-size-image-url="https://www.excalibur-comics.fr/30174-large_default/the-magic-order-tome-2-poche.jpg">
                            </a>
                        </div>
                    </div>
                    <div class="product-right">
                        <div class="product-description">
                            <h3 class="h3 product-title">
                                <a href="https://www.excalibur-comics.fr/panini-poche/18717-the-magic-order-tome-2-poche-9791070262764.html">The Magic Order Tome 2 - Poche</a>
                            </h3>
                        </div>
                        <div class="product-bottom">
                            <div class="product-price-and-shipping">
                                <span class="price">15,99 €</span>
                            </div>
                            <div class="button-container">
                                <button class="btn add-to-cart">
                                    <span class="date-btn">24/02/2027</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        """;

        Document doc = Jsoup.parse(html, "https://www.excalibur-comics.fr/715-panini-comics-france");
        Element card = doc.select("article.product-miniature").first();
        assertNotNull(card);

        ScrapedBookDTO book = source.parseCard(card, "https://www.excalibur-comics.fr/715-panini-comics-france");
        assertNotNull(book);
        assertEquals("The Magic Order Tome 2 - Poche", book.getTitle());
        assertEquals("9791070262764", book.getIsbn());
        assertEquals("Panini Comics", book.getEditorName());
        assertEquals("Comics", book.getCategoryName());
        assertEquals(16, book.getPrice());
        assertEquals(LocalDate.of(2027, 2, 24), book.getReleaseDate());
        assertEquals("https://www.excalibur-comics.fr/30174-large_default/the-magic-order-tome-2-poche.jpg", book.getCoverUrl());
    }

    @Test
    void testExtractNextPageUrl() {
        String html = """
            <nav class="pagination">
                <ul class="page-list">
                    <li><a rel="next" href="https://www.excalibur-comics.fr/715-panini-comics-france?page=2" class="next js-search-link">Suivant</a></li>
                </ul>
            </nav>
        """;
        Document doc = Jsoup.parse(html, "https://www.excalibur-comics.fr/715-panini-comics-france");
        String nextUrl = PaniniComicsSource.extractNextPageUrl(doc, "https://www.excalibur-comics.fr/715-panini-comics-france");
        assertEquals("https://www.excalibur-comics.fr/715-panini-comics-france?page=2", nextUrl);
    }
}
