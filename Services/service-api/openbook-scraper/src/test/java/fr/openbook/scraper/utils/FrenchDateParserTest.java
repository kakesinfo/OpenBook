package fr.openbook.scraper.utils;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.Month;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class FrenchDateParserTest {

    @Test
    void testParseFrenchDates() {
        LocalDate d1 = FrenchDateParser.parse("21 novembre 2025");
        assertNotNull(d1);
        assertEquals(2025, d1.getYear());
        assertEquals(Month.NOVEMBER, d1.getMonth());
        assertEquals(21, d1.getDayOfMonth());

        LocalDate d2 = FrenchDateParser.parse("5 mai 2024");
        assertNotNull(d2);
        assertEquals(2024, d2.getYear());
        assertEquals(Month.MAY, d2.getMonth());
        assertEquals(5, d2.getDayOfMonth());

        LocalDate d3 = FrenchDateParser.parse("02 octobre 2026");
        assertNotNull(d3);
        assertEquals(2026, d3.getYear());
        assertEquals(Month.OCTOBER, d3.getMonth());
        assertEquals(2, d3.getDayOfMonth());

        LocalDate d4 = FrenchDateParser.parse("1er mars 2025");
        assertNotNull(d4);
        assertEquals(2025, d4.getYear());
        assertEquals(Month.MARCH, d4.getMonth());
        assertEquals(1, d4.getDayOfMonth());

        LocalDate d5 = FrenchDateParser.parse("2025-06-18");
        assertNotNull(d5);
        assertEquals(LocalDate.of(2025, 6, 18), d5);
    }
}
