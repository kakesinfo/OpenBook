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

        assertEquals("iv james tynion", key1);
        assertEquals(key1, key2);
        assertEquals(key1, key3);
        assertEquals(key1, key4);
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
}
