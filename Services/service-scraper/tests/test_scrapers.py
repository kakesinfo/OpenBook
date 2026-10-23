import unittest
from datetime import datetime
from bs4 import BeautifulSoup

from scrapers.base import (
    ScrapedBook,
    ScrapedAuthor,
    clean_text,
    clean_author_name,
    split_author_name,
    is_variant_book,
    is_variant_title,
    strip_variant_suffix,
    extract_canonical_series_and_volume
)
from scrapers import SCRAPERS, get_scraper
from scrapers.urban_comics import (
    parse_french_date,
    slug_title,
    parse_authors,
    parse_description,
    parse_series_and_volume
)
from scrapers.monsieur_toussaint_louverture import (
    parse_series_and_volume as parse_mtl_series_and_volume,
    OBJET_KEYWORDS,
    EPUB_KEYWORDS
)
from scrapers.mangetsu import MangetsuScraper
from scrapers.panini_comics import PaniniComicsScraper

class TestScrapers(unittest.TestCase):
    def test_registry(self):
        expected = ["urban_comics", "panini", "morgen_bd", "mangetsu", "label619", "monsieur_toussaint_louverture"]
        for name in expected:
            self.assertIn(name, SCRAPERS)
            scraper = get_scraper(name)
            self.assertEqual(scraper.name, name)

    def test_french_date_parser(self):
        d1 = parse_french_date("21 novembre 2025")
        self.assertIsNotNone(d1)
        self.assertEqual(d1.year, 2025)
        self.assertEqual(d1.month, 11)
        self.assertEqual(d1.day, 21)

        d2 = parse_french_date("5 mai 2024")
        self.assertIsNotNone(d2)
        self.assertEqual(d2.month, 5)

        d3 = parse_french_date("02 octobre 2026")
        self.assertIsNotNone(d3)
        self.assertEqual(d3.year, 2026)
        self.assertEqual(d3.month, 10)
        self.assertEqual(d3.day, 2)

    def test_slug_title(self):
        slug = slug_title("Absolute Flash Tome 1")
        self.assertEqual(slug, "absolute-flash-tome-1")

    def test_clean_text_mojibake_repair(self):
        # Mojibake fixes
        self.assertEqual(clean_text("Le Château des Animaux"), "Le Château des Animaux")
        self.assertEqual(clean_text("Le fils du démon"), "Le fils du démon")
        self.assertEqual(clean_text("X-Men (Intégrale)"), "X-Men (Intégrale)")
        self.assertEqual(clean_text("Siège"), "Siège")
        # HTML entities fixes
        self.assertEqual(clean_text("Spider-Man &amp; Batman"), "Spider-Man & Batman")
        self.assertEqual(clean_text("L&#x27;aventure"), "L'aventure")

    def test_clean_author_name_prefixes(self):
        # Role prefixes concatenated or with separator
        self.assertEqual(clean_author_name("Auteur + illustrateurMathieu Bablet"), "Mathieu Bablet")
        self.assertEqual(clean_author_name("Par Auteur + illustrateurMathieu Bablet"), "Mathieu Bablet")
        self.assertEqual(clean_author_name("IllustrateurFlorent Maudoux"), "Florent Maudoux")
        self.assertEqual(clean_author_name("Scénariste et dessinateurRun"), "Run")
        self.assertEqual(clean_author_name("Texte et illustration deBones"), "Bones")
        self.assertEqual(clean_author_name("AuteurNeyef"), "Neyef")
        self.assertEqual(clean_author_name("Illustration deRours"), "Rours")
        self.assertEqual(clean_author_name("Scénario deIsabelle Bauthian"), "Isabelle Bauthian")
        self.assertEqual(clean_author_name("Par Mathieu Bablet"), "Mathieu Bablet")
        # Legitimate particles preserved
        self.assertEqual(clean_author_name("Christian de Metter"), "Christian de Metter")
        self.assertEqual(clean_author_name("Faustin de Ravignan"), "Faustin de Ravignan")

    def test_split_author_name(self):
        self.assertEqual(split_author_name("Auteur + illustrateurMathieu Bablet"), ("Mathieu", "Bablet"))
        self.assertEqual(split_author_name("Mathieu Bablet"), ("Mathieu", "Bablet"))
        self.assertEqual(split_author_name("RUN"), ("", "RUN"))
        self.assertEqual(split_author_name("Scénariste et dessinateurRun"), ("", "Run"))
        self.assertEqual(split_author_name("Florence Dupré la Tour"), ("Florence", "Dupré la Tour"))
        self.assertEqual(split_author_name(""), ("", ""))

    def test_variant_utilities(self):
        # strip_variant_suffix
        self.assertEqual(
            strip_variant_suffix("X-Men - Shadows of Tomorrow N°06 - Edition collector"),
            "X-Men - Shadows of Tomorrow N°06"
        )
        self.assertEqual(
            strip_variant_suffix("Spider-Man Tome 1 (Variant site)"),
            "Spider-Man Tome 1"
        )
        self.assertEqual(
            strip_variant_suffix("Batman T01 Édition Prestige"),
            "Batman T01"
        )
        self.assertEqual(
            strip_variant_suffix("Regular Book"),
            "Regular Book"
        )

        # extract_canonical_series_and_volume
        s, v = extract_canonical_series_and_volume("X-Men - Shadows of Tomorrow N°06 - Edition collector")
        self.assertEqual(s, "X-Men - Shadows of Tomorrow")
        self.assertEqual(v, 6)

        s, v = extract_canonical_series_and_volume("X-Men (2026) N° 01")
        self.assertEqual(s, "X-Men (2026)")
        self.assertEqual(v, 1)

        s, v = extract_canonical_series_and_volume("Ultimate Spider-Man Tome 3")
        self.assertEqual(s, "Ultimate Spider-Man")
        self.assertEqual(v, 3)

        s, v = extract_canonical_series_and_volume("Civil War")
        self.assertEqual(s, "Civil War")
        self.assertIsNone(v)

        # is_variant_book / is_variant_title
        self.assertTrue(is_variant_book("X-Men N°01 - Edition collector", None, None))
        self.assertTrue(is_variant_book("X-Men N°01", "https://panini.fr/fxm26014v_0.jpg", "FXM26014_FR02"))
        self.assertTrue(is_variant_book("X-Men N°01", "https://panini.fr/fxm26014_0.jpg", "FXM26014V_FR02"))
        self.assertFalse(is_variant_book("Star Wars Tome 02", "https://panini.fr/fsw26002_0.jpg", "FSW26002_FR02"))

    def test_monsieur_toussaint_louverture_series_and_volume(self):
        s1, v1 = parse_mtl_series_and_volume("Blackwater I, La Crue – L’épique saga de la famille Caskey")
        self.assertEqual(s1, "Blackwater")
        self.assertEqual(v1, 1)

        s2, v2 = parse_mtl_series_and_volume("Blackwater IV, La Guerre – L’épique saga de la famille Caskey")
        self.assertEqual(s2, "Blackwater")
        self.assertEqual(v2, 4)

        s3, v3 = parse_mtl_series_and_volume("L’Heure du loup – Volume 1")
        self.assertEqual(s3, "L’Heure du loup")
        self.assertEqual(v3, 1)

        s4, v4 = parse_mtl_series_and_volume("MIND MGMT – Rapport d’opérations 2/3")
        self.assertEqual(s4, "MIND MGMT")
        self.assertEqual(v4, 2)

        s5, v5 = parse_mtl_series_and_volume("Moi, ce que j’aime, c’est les monstres – Livre deuxième")
        self.assertEqual(s5, "Moi, ce que j’aime, c’est les monstres")
        self.assertEqual(v5, 2)

        s6, v6 = parse_mtl_series_and_volume("Les Élémentaires")
        self.assertEqual(s6, "Les Élémentaires")
        self.assertIsNone(v6)

    def test_monsieur_toussaint_louverture_exclusion_keywords(self):
        # Excluded items
        self.assertTrue(any(k in "sérigraphie blackwater" for k in OBJET_KEYWORDS))
        self.assertTrue(any(k in "lot de 3 carnets du blackwater fishing club" for k in OBJET_KEYWORDS))
        self.assertTrue(any(k in "coffret l’heure du loup (vide)" for k in OBJET_KEYWORDS))
        self.assertTrue(any(k in "tasse blackwater fishing club" for k in OBJET_KEYWORDS))
        self.assertTrue(any(k in "swan song t1 – le feu et la glace / epub".lower() for k in EPUB_KEYWORDS))

        # Real books must NOT match
        self.assertFalse(any(k in "les élémentaires".lower() for k in OBJET_KEYWORDS))
        self.assertFalse(any(k in "blackwater édition intégrale".lower() for k in OBJET_KEYWORDS))
        self.assertFalse(any(k in "l’heure du loup – volume 1".lower() for k in OBJET_KEYWORDS))

    def test_urban_comics_parse_authors(self):
        html = """
        <h5 class="authors">
            scénariste : <a href="/mattson-tomlin/">Mattson  Tomlin</a><br/>
            dessinateur : <a href="/bermejo-lee/">Lee Bermejo</a><br/>
            traducteur : <a href="/yann-graf/">Yann Graf</a>
        </h5>
        """
        soup = BeautifulSoup(html, "html.parser")
        authors = parse_authors(soup)
        self.assertEqual(len(authors), 3)
        self.assertEqual(authors[0].firstname, "Mattson")
        self.assertEqual(authors[0].lastname, "Tomlin")
        self.assertEqual(authors[0].role, "Writer")

        self.assertEqual(authors[1].firstname, "Lee")
        self.assertEqual(authors[1].lastname, "Bermejo")
        self.assertEqual(authors[1].role, "Illustrator")

        self.assertEqual(authors[2].firstname, "Yann")
        self.assertEqual(authors[2].lastname, "Graf")
        self.assertEqual(authors[2].role, "Translator")

    def test_urban_comics_parse_authors_filters_navigation_links(self):
        html = """
        <h5 class="authors">
            <a href="/category/auteurs/interviews/">Interviews</a>
            <a href="/category/auteurs/portfolio-2/">Portfolio</a>
            scénariste : <a href="/rick-remender/">Rick REMENDER</a>
        </h5>
        """
        soup = BeautifulSoup(html, "html.parser")
        authors = parse_authors(soup)
        self.assertEqual(len(authors), 1)
        self.assertEqual(authors[0].firstname, "Rick")
        self.assertEqual(authors[0].lastname, "Remender")
        self.assertEqual(authors[0].role, "Writer")

    def test_urban_comics_parse_series_and_volume(self):
        html = """
        <div class="eightcol first">
            <h1 id="titre-album">A Vicious Circle tome 1</h1>
            <div class="serie_album">Série : <a href="/a-vicious-circle-serie/">A Vicious Circle</a></div>
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        series, vol = parse_series_and_volume("A Vicious Circle tome 1", soup)
        self.assertEqual(series, "A Vicious Circle")
        self.assertEqual(vol, 1)

    def test_mangetsu_pagination_next_page(self):
        html_page1 = """
        <div class="pagination">
            <nav>
                <span class="disabled">Previous</span>
                <span class="current">1</span>
                <a href="/catalogue/?page=2">2</a>
                <a href="/catalogue/?page=33">33</a>
                <a href="/catalogue/?page=2" rel="next">Next</a>
            </nav>
        </div>
        """
        scraper = MangetsuScraper()
        soup = BeautifulSoup(html_page1, "html.parser")
        next_url = scraper._extract_next_page_url(soup, "https://mangetsu-manga.fr/catalogue/", "https://mangetsu-manga.fr", set())
        self.assertEqual(next_url, "https://mangetsu-manga.fr/catalogue/?page=2")

    def test_mangetsu_pagination_last_page(self):
        html_last = """
        <div class="pagination">
            <nav>
                <a href="/catalogue/?page=32" rel="prev">Previous</a>
                <a href="/catalogue/?page=1">1</a>
                <span class="current">33</span>
                <span class="disabled">Next</span>
            </nav>
        </div>
        """
        scraper = MangetsuScraper()
        soup = BeautifulSoup(html_last, "html.parser")
        next_url = scraper._extract_next_page_url(soup, "https://mangetsu-manga.fr/catalogue/?page=33", "https://mangetsu-manga.fr", set())
        self.assertIsNone(next_url)

    def test_mangetsu_pagination_absent(self):
        html_no_pagi = "<div><p>Pas de pagination ici</p></div>"
        scraper = MangetsuScraper()
        soup = BeautifulSoup(html_no_pagi, "html.parser")
        next_url = scraper._extract_next_page_url(soup, "https://mangetsu-manga.fr/a-paraitre/", "https://mangetsu-manga.fr", set())
        self.assertIsNone(next_url)

    def test_panini_comics_catalog_urls(self):
        expected_urls = [
            "https://www.panini.fr/shp_fra_fr/comics/marvel.html",
            "https://www.panini.fr/shp_fra_fr/comics/star-wars.html",
            "https://www.panini.fr/shp_fra_fr/comics/disney.html",
            "https://www.panini.fr/shp_fra_fr/comics/autres-comics.html"
        ]
        self.assertEqual(PaniniComicsScraper.CATALOG_URLS, expected_urls)

    def test_panini_comics_pagination_page_1(self):
        html = """
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
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        next_url = PaniniComicsScraper.extract_next_page_url(soup, "https://www.panini.fr/shp_fra_fr/comics/disney.html")
        self.assertEqual(next_url, "https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2&pnn_is_not_presale=En+vente&pnn_is_saleable=1")

    def test_panini_comics_pagination_last_page(self):
        html = """
        <div class="pages">
            <strong class="label pages-label" id="paging-label">Page</strong>
            <ul class="items pages-items" aria-labelledby="paging-label">
                <li class="item pages-item-previous">
                    <a class="action previous" href="https://www.panini.fr/shp_fra_fr/comics/disney.html?pnn_is_not_presale=En+vente&amp;pnn_is_saleable=1" title="Précédent">
                        <span class="label">Page</span>
                        <span>Précédent</span>
                    </a>
                </li>
                <li class="item">
                    <a class="page" href="https://www.panini.fr/shp_fra_fr/comics/disney.html?pnn_is_not_presale=En+vente&amp;pnn_is_saleable=1">
                        <span class="label">Page</span>
                        <span>1</span>
                    </a>
                </li>
                <li class="item current">
                    <strong class="page">
                        <span class="label">Vous lisez actuellement la page</span>
                        <span>2</span>
                    </strong>
                </li>
            </ul>
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        next_url = PaniniComicsScraper.extract_next_page_url(soup, "https://www.panini.fr/shp_fra_fr/comics/disney.html?p=2")
        self.assertIsNone(next_url)

    def test_panini_comics_pagination_absent(self):
        html = "<div><p>Aucun produit</p></div>"
        soup = BeautifulSoup(html, "html.parser")
        next_url = PaniniComicsScraper.extract_next_page_url(soup, "https://www.panini.fr/shp_fra_fr/comics/marvel.html")
        self.assertIsNone(next_url)

    def test_panini_comics_parse_card(self):
        html = """
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
        """
        soup = BeautifulSoup(html, "html.parser")
        card = soup.select_one("li.item.product.product-item")
        scraper = PaniniComicsScraper()
        book = scraper._parse_card(card, base_url="https://www.panini.fr/shp_fra_fr/comics/star-wars.html")
        self.assertIsNotNone(book)
        self.assertEqual(book.title, "Star Wars Tome 02")
        self.assertEqual(book.series_name, "Star Wars")
        self.assertEqual(book.volume, 2)
        self.assertEqual(book.price, 16)
        self.assertEqual(book.editor_name, "Panini Comics")
        self.assertEqual(book.category_name, "Comics")
        self.assertEqual(book.cover_url, "https://www.panini.fr/media/catalog/product/f/s/fsw26002_0.jpg")
        self.assertEqual(book.isbn, "9782809499999")
        self.assertEqual(book.release_date.year, 2026)
        self.assertEqual(book.release_date.month, 10)
        self.assertEqual(book.release_date.day, 20)
        self.assertFalse(book.is_variant)

    def test_panini_comics_parse_variant_card(self):
        html = """
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
        """
        soup = BeautifulSoup(html, "html.parser")
        card = soup.select_one("li.item.product.product-item")
        scraper = PaniniComicsScraper()
        book = scraper._parse_card(card, base_url="https://www.panini.fr/shp_fra_fr/comics/marvel.html")
        self.assertIsNotNone(book)
        self.assertTrue(book.is_variant)
        self.assertEqual(book.title, "X-Men - Shadows of Tomorrow N°06 - Edition collector")
        self.assertEqual(book.series_name, "X-Men - Shadows of Tomorrow")
        self.assertEqual(book.volume, 6)
        self.assertEqual(book.price, 20)

    def test_scraped_book_with_collection(self):
        book = ScrapedBook(
            title="Tomie T01",
            series_name="Tomie",
            series_qualifier="Poche",
            volume=1,
            isbn="9782382816967",
            editor_name="Mangetsu",
            collection_name="Junji Ito",
            page_count=240,
            price=8
        )
        self.assertEqual(book.collection_name, "Junji Ito")
        self.assertEqual(book.series_qualifier, "Poche")

    def test_scraped_book_model(self):
        book = ScrapedBook(
            title=clean_text("Batman : Un long Halloween"),
            series_name="Batman",
            volume=1,
            isbn="9782365771788",
            editor_name="Urban Comics",
            page_count=392,
            price=35,
            cover_url="https://example.com/cover.jpg",
            authors=[
                ScrapedAuthor(firstname="Jeph", lastname="Loeb", role="Writer"),
                ScrapedAuthor(firstname="Tim", lastname="Sale", role="Illustrator")
            ]
        )
        self.assertEqual(book.title, "Batman : Un long Halloween")
        self.assertEqual(book.editor_name, "Urban Comics")
        self.assertEqual(len(book.authors), 2)
        self.assertEqual(book.authors[0].lastname, "Loeb")

    def test_on_book_found_callback_signature(self):
        from scrapers.base import BaseScraper
        import inspect
        for scraper_cls in SCRAPERS.values():
            sig = inspect.signature(scraper_cls.scrape)
            self.assertIn('on_book_found', sig.parameters)

if __name__ == "__main__":
    unittest.main()
