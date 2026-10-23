import unittest
from bnf_client import (
    clean_title_for_cql,
    clean_publisher_for_cql,
    parse_bnf_creator,
    parse_bnf_page_count,
    parse_bnf_collection,
    parse_bnf_date,
    extract_bnf_volume,
    search_bnf_book,
    lookup_bnf_by_isbn,
)

class TestBnfClient(unittest.TestCase):
    def test_clean_title_for_cql(self):
        cleaned = clean_title_for_cql('X-Men: Shadows (Collector) - Tome "1"')
        self.assertNotIn(":", cleaned)
        self.assertNotIn("(", cleaned)
        self.assertNotIn(")", cleaned)
        self.assertNotIn('"', cleaned)
        self.assertIn("Men", cleaned)
        self.assertIn("Shadows", cleaned)

    def test_clean_publisher_for_cql(self):
        self.assertEqual(clean_publisher_for_cql("Panini Comics"), "Panini")
        self.assertEqual(clean_publisher_for_cql("Urban Comics"), "Urban")
        self.assertEqual(clean_publisher_for_cql("Mangetsu"), "Mangetsu")

    def test_parse_bnf_page_count(self):
        self.assertEqual(parse_bnf_page_count("1 vol. (176 p.) : ill. en coul. ; 26 cm"), 176)
        self.assertEqual(parse_bnf_page_count("1 vol. ([880] p.) : ill. en coul. ; 29 cm"), 880)
        self.assertIsNone(parse_bnf_page_count("Pagination multiple"))

    def test_parse_bnf_collection(self):
        self.assertEqual(
            parse_bnf_collection('Collection : Marvel Deluxe'),
            "Marvel Deluxe"
        )
        self.assertEqual(
            parse_bnf_collection('Collection : Comics. Marvel omnibus'),
            "Marvel omnibus"
        )

    def test_parse_bnf_creator(self):
        first, last, role = parse_bnf_creator("Carey, Mike (1959-....). Auteur du texte")
        self.assertEqual(first, "Mike")
        self.assertEqual(last, "Carey")
        self.assertEqual(role, "Writer")

        first, last, role = parse_bnf_creator("Pasqual Ferry (1961-....). Illustrateur")
        self.assertEqual(last, "Pasqual Ferry")
        self.assertEqual(role, "Illustrator")

    def test_parse_bnf_date(self):
        d1 = parse_bnf_date("2026")
        self.assertIsNotNone(d1)
        self.assertEqual(d1.year, 2026)

        d2 = parse_bnf_date("2026-03-15")
        self.assertIsNotNone(d2)
        self.assertEqual(d2.month, 3)

    def test_extract_bnf_volume(self):
        self.assertEqual(extract_bnf_volume("Ultimate Fantastic Four. 2"), 2)
        self.assertEqual(extract_bnf_volume("X-Men, Shadows of tomorrow. 04 [Édition collector]"), 4)


    def test_lookup_bnf_by_isbn_invalid(self):
        self.assertIsNone(lookup_bnf_by_isbn(""))
        self.assertIsNone(lookup_bnf_by_isbn("123"))

    def test_lookup_bnf_by_isbn_sample(self):
        # Known real BNF record for Ultimate Fantastic Four Vol 2
        res = lookup_bnf_by_isbn("9791039149013")
        self.assertIsNotNone(res)
        self.assertEqual(res["isbn"], "9791039149013")
        self.assertEqual(res["page_count"], 880)
        self.assertEqual(res["volume"], 2)

if __name__ == "__main__":
    unittest.main()
