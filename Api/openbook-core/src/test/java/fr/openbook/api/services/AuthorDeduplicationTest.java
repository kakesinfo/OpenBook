package fr.openbook.api.services;

import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.repositories.AuthorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class AuthorDeduplicationTest {

    private AuthorRepository authorRepository;
    private JdbcTemplate jdbcTemplate;
    private AuthorDeduplicationService deduplicationService;

    @BeforeEach
    void setUp() {
        authorRepository = mock(AuthorRepository.class);
        jdbcTemplate = mock(JdbcTemplate.class);
        deduplicationService = new AuthorDeduplicationService(authorRepository, jdbcTemplate);
    }

    @Test
    void testComputeTokenKeyInversion() {
        String key1 = AuthorDeduplicationService.computeTokenKey("James", "Tynion IV");
        String key2 = AuthorDeduplicationService.computeTokenKey("TYNION", "IV James");
        String key3 = AuthorDeduplicationService.computeTokenKey("", "TYNION IV James");
        String key4 = AuthorDeduplicationService.computeTokenKey("James", "TYNION IV");

        // "iv" est un suffixe ignorable : supprimé quand au moins 2 vrais tokens restent
        assertEquals("james tynion", key1);
        assertEquals(key1, key2);
        assertEquals(key1, key3);
        assertEquals(key1, key4);
    }

    @Test
    void testComputeTokenKeyKeepsSuffixWithoutOtherTokens() {
        // "iv" est conservé s'il ne reste qu'un seul autre token
        assertEquals("iv james", AuthorDeduplicationService.computeTokenKey("James", "IV"));
    }

    @Test
    void testComputeTokenKeyAccentsAndPunctuation() {
        String key1 = AuthorDeduplicationService.computeTokenKey("Émile", "Zola");
        String key2 = AuthorDeduplicationService.computeTokenKey("Emile", "ZOLA");
        String key3 = AuthorDeduplicationService.computeTokenKey("Zola,", "Émile!");

        assertEquals("emile zola", key1);
        assertEquals(key1, key2);
        assertEquals(key1, key3);
    }

    @Test
    void testComputeTokenKeyJapaneseMacrons() {
        String keyMacron = AuthorDeduplicationService.computeTokenKey("Gō", "Tanabe");
        String keyDigraph = AuthorDeduplicationService.computeTokenKey("Gou", "Tanabe");
        String keyInverted = AuthorDeduplicationService.computeTokenKey("TANABE", "Gō");

        assertEquals("gou tanabe", keyMacron);
        assertEquals(keyMacron, keyDigraph);
        assertEquals(keyMacron, keyInverted);
    }

    @Test
    void testCalculateNameQualityScore() {
        int scoreGood = AuthorDeduplicationService.calculateNameQualityScore("James", "Tynion IV");
        int scoreBad = AuthorDeduplicationService.calculateNameQualityScore("TYNION", "IV James");
        int scoreSingle = AuthorDeduplicationService.calculateNameQualityScore("", "TYNION IV James");

        assertTrue(scoreGood > scoreBad, "Title Case name should have higher score than all-caps");
        assertTrue(scoreGood > scoreSingle, "Split firstname/lastname should have higher score than single field");
    }

    @Test
    void testFindExistingDuplicateFindsInverted() {
        AuthorEntity existing = new AuthorEntity();
        existing.setId(21);
        existing.setFirstname("James");
        existing.setLastname("Tynion IV");

        when(authorRepository.findAll()).thenReturn(List.of(existing));

        // Looking for "TYNION IV James"
        Optional<AuthorEntity> match = deduplicationService.findExistingDuplicate("TYNION", "IV James");

        assertTrue(match.isPresent());
        assertEquals(21, match.get().getId());
    }

    @Test
    void testFindOrCreateAuthorReturnsExistingAndUpgradesIfBetter() {
        AuthorEntity existing = new AuthorEntity();
        existing.setId(61);
        existing.setFirstname("TYNION");
        existing.setLastname("IV James");

        when(authorRepository.findAll()).thenReturn(List.of(existing));
        when(authorRepository.save(any(AuthorEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        // Better formatted name comes in
        AuthorEntity result = deduplicationService.findOrCreateAuthor("James", "Tynion IV");

        assertNotNull(result);
        assertEquals(61, result.getId());
        assertEquals("James", result.getFirstname());
        assertEquals("Tynion IV", result.getLastname());
        verify(authorRepository).save(existing);
    }

    @Test
    void testFindExistingDuplicateMatchesUnambiguousSingleToken() {
        AuthorEntity mathieuBablet = new AuthorEntity();
        mathieuBablet.setId(10);
        mathieuBablet.setFirstname("Mathieu");
        mathieuBablet.setLastname("Bablet");

        AuthorEntity georgeMartin = new AuthorEntity();
        georgeMartin.setId(11);
        georgeMartin.setFirstname("George");
        georgeMartin.setLastname("Martin");

        AuthorEntity jeanMartin = new AuthorEntity();
        jeanMartin.setId(12);
        jeanMartin.setFirstname("Jean");
        jeanMartin.setLastname("Martin");

        when(authorRepository.findAll()).thenReturn(List.of(mathieuBablet, georgeMartin, jeanMartin));

        Optional<AuthorEntity> babletMatch = deduplicationService.findExistingDuplicate("", "Bablet");
        assertTrue(babletMatch.isPresent());
        assertEquals(10, babletMatch.get().getId());

        Optional<AuthorEntity> martinMatch = deduplicationService.findExistingDuplicate("", "Martin");
        assertTrue(martinMatch.isEmpty(), "Ambiguous surname 'Martin' should not auto-match");
    }

    @Test
    void testComputeTokenKeyDotWithoutSpace() {
        String keyNoSpace = AuthorDeduplicationService.computeTokenKey("Sarah", "J.Mass");
        String keyWithSpace = AuthorDeduplicationService.computeTokenKey("Sarah J.", "Mass");
        String keySingleField = AuthorDeduplicationService.computeTokenKey("", "Sarah J.Mass");

        assertEquals("j mass sarah", keyNoSpace);
        assertEquals(keyNoSpace, keyWithSpace);
        assertEquals(keyNoSpace, keySingleField);
    }
}
