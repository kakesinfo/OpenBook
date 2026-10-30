package fr.openbook.scraper.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VariantDetectorTest {

    @Test
    void testStripVariantSuffix() {
        assertEquals("X-Men - Shadows of Tomorrow N°06", VariantDetector.stripVariantSuffix("X-Men - Shadows of Tomorrow N°06 - Edition collector"));
        assertEquals("Spider-Man Tome 1", VariantDetector.stripVariantSuffix("Spider-Man Tome 1 (Variant site)"));
        assertEquals("Batman T01", VariantDetector.stripVariantSuffix("Batman T01 Édition Prestige"));
        assertEquals("Regular Book", VariantDetector.stripVariantSuffix("Regular Book"));
    }

    @Test
    void testExtractCanonicalSeriesAndVolume() {
        VariantDetector.SeriesVolume sv1 = VariantDetector.extractCanonicalSeriesAndVolume("X-Men - Shadows of Tomorrow N°06 - Edition collector");
        assertEquals("X-Men - Shadows of Tomorrow", sv1.series());
        assertEquals(6, sv1.volume());

        VariantDetector.SeriesVolume sv2 = VariantDetector.extractCanonicalSeriesAndVolume("X-Men (2026) N° 01");
        assertEquals("X-Men (2026)", sv2.series());
        assertEquals(1, sv2.volume());

        VariantDetector.SeriesVolume sv3 = VariantDetector.extractCanonicalSeriesAndVolume("Ultimate Spider-Man Tome 3");
        assertEquals("Ultimate Spider-Man", sv3.series());
        assertEquals(3, sv3.volume());

        VariantDetector.SeriesVolume sv4 = VariantDetector.extractCanonicalSeriesAndVolume("Civil War");
        assertEquals("Civil War", sv4.series());
        assertNull(sv4.volume());
    }

    @Test
    void testIsVariantBook() {
        assertTrue(VariantDetector.isVariantBook("X-Men N°01 - Edition collector", "", ""));
        assertTrue(VariantDetector.isVariantBook("X-Men N°01", "https://panini.fr/fxm26014v_0.jpg", "FXM26014_FR02"));
        assertTrue(VariantDetector.isVariantBook("X-Men N°01", "https://panini.fr/fxm26014_0.jpg", "FXM26014V_FR02"));
        assertFalse(VariantDetector.isVariantBook("Star Wars Tome 02", "https://panini.fr/fsw26002_0.jpg", "FSW26002_FR02"));
    }
}
