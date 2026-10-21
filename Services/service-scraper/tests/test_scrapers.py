import unittest
from datetime import datetime
from scrapers.base import ScrapedBook, ScrapedAuthor, clean_text
from scrapers import SCRAPERS, get_scraper
from scrapers.urban_comics import parse_french_date, slug_title

class TestScrapers(unittest.TestCase):
    def test_registry(self):
        expected = ["urban_comics", "panini", "bubble_bd", "morgen_bd", "mangetsu", "label619"]
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

if __name__ == "__main__":
    unittest.main()
