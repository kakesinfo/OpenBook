import unittest
from datetime import datetime
from bs4 import BeautifulSoup

from scrapers.base import ScrapedBook, ScrapedAuthor, clean_text, clean_author_name, split_author_name
from scrapers import SCRAPERS, get_scraper
from scrapers.urban_comics import (
    parse_french_date,
    slug_title,
    parse_authors,
    parse_description,
    parse_series_and_volume
)

class TestScrapers(unittest.TestCase):
    def test_registry(self):
        expected = ["urban_comics", "panini", "morgen_bd", "mangetsu", "label619"]
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
        self.assertEqual(clean_text("Le ChÃ¢teau des Animaux"), "Le Château des Animaux")
        self.assertEqual(clean_text("Le fils du dÃ©mon"), "Le fils du démon")
        self.assertEqual(clean_text("X-Men (IntÃ©grale)"), "X-Men (Intégrale)")
        self.assertEqual(clean_text("SiÃ¨ge"), "Siège")
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
