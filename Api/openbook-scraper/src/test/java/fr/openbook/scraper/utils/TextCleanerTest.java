package fr.openbook.scraper.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class TextCleanerTest {

    @Test
    void testCleanTextHtmlAndMojibake() {
        assertEquals("Le Château des Animaux", TextCleaner.cleanText("Le Château des Animaux"));
        assertEquals("Le fils du démon", TextCleaner.cleanText("Le fils du démon"));
        assertEquals("X-Men (Intégrale)", TextCleaner.cleanText("X-Men (Intégrale)"));
        assertEquals("Siège", TextCleaner.cleanText("Siège"));
        assertEquals("Spider-Man & Batman", TextCleaner.cleanText("Spider-Man &amp; Batman"));
        assertEquals("L'aventure", TextCleaner.cleanText("L&#x27;aventure"));
    }

    @Test
    void testCleanAuthorNamePrefixes() {
        assertEquals("Mathieu Bablet", TextCleaner.cleanAuthorName("Auteur + illustrateurMathieu Bablet"));
        assertEquals("Mathieu Bablet", TextCleaner.cleanAuthorName("Par Auteur + illustrateurMathieu Bablet"));
        assertEquals("Florent Maudoux", TextCleaner.cleanAuthorName("IllustrateurFlorent Maudoux"));
        assertEquals("Run", TextCleaner.cleanAuthorName("Scénariste et dessinateurRun"));
        assertEquals("Bones", TextCleaner.cleanAuthorName("Texte et illustration deBones"));
        assertEquals("Neyef", TextCleaner.cleanAuthorName("AuteurNeyef"));
        assertEquals("Rours", TextCleaner.cleanAuthorName("Illustration deRours"));
        assertEquals("Isabelle Bauthian", TextCleaner.cleanAuthorName("Scénario deIsabelle Bauthian"));
        assertEquals("Mathieu Bablet", TextCleaner.cleanAuthorName("Par Mathieu Bablet"));
        assertEquals("Christian de Metter", TextCleaner.cleanAuthorName("Christian de Metter"));
        assertEquals("Faustin de Ravignan", TextCleaner.cleanAuthorName("Faustin de Ravignan"));
    }

    @Test
    void testSplitAuthorName() {
        assertArrayEquals(new String[]{"Mathieu", "Bablet"}, TextCleaner.splitAuthorName("Auteur + illustrateurMathieu Bablet"));
        assertArrayEquals(new String[]{"Mathieu", "Bablet"}, TextCleaner.splitAuthorName("Mathieu Bablet"));
        assertArrayEquals(new String[]{"", "RUN"}, TextCleaner.splitAuthorName("RUN"));
        assertArrayEquals(new String[]{"", "Run"}, TextCleaner.splitAuthorName("Scénariste et dessinateurRun"));
        assertArrayEquals(new String[]{"Florence", "Dupré la Tour"}, TextCleaner.splitAuthorName("Florence Dupré la Tour"));
    }
}
