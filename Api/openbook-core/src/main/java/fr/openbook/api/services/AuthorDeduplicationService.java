package fr.openbook.api.services;

import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.repositories.AuthorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthorDeduplicationService {

    private final AuthorRepository authorRepository;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Computes a canonical token key for author deduplication.
     * Tokens are lowercased, stripped of accents/punctuation, and sorted alphabetically.
     * E.g. "James", "Tynion IV" -> "iv james tynion"
     *      "TYNION", "IV James" -> "iv james tynion"
     *      "", "TYNION IV James" -> "iv james tynion"
     */
    public static String computeTokenKey(String firstname, String lastname) {
        String combined = ((firstname != null ? firstname : "") + " " + (lastname != null ? lastname : "")).trim();
        if (combined.isEmpty()) {
            return "";
        }

        // 1. Strip accents
        String normalized = Normalizer.normalize(combined, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        // 2. Lowercase
        normalized = normalized.toLowerCase(Locale.ROOT);

        // 3. Replace non-alphanumeric characters with spaces
        normalized = normalized.replaceAll("[^a-z0-9]+", " ");

        // 4. Split tokens, sort alphabetically and join
        String[] tokens = normalized.trim().split("\\s+");
        if (tokens.length == 0 || (tokens.length == 1 && tokens[0].isEmpty())) {
            return "";
        }

        Arrays.sort(tokens);
        return String.join(" ", tokens);
    }

    /**
     * Measures how clean and canonical an author's name is.
     * Higher score = better formatting (Title Case, both firstname/lastname present, diacritics preserved, no quotes).
     */
    public static int calculateNameQualityScore(String firstname, String lastname) {
        int score = 0;
        String fn = firstname != null ? firstname.trim() : "";
        String ln = lastname != null ? lastname.trim() : "";

        if (!fn.isEmpty() && !ln.isEmpty()) {
            score += 100; // Both fields properly filled
        } else if (!ln.isEmpty() || !fn.isEmpty()) {
            score += 20;
        }

        // Penalty for ALL CAPS
        if (isAllCaps(fn)) {
            score -= 40;
        } else if (isTitleCase(fn)) {
            score += 25;
        }

        if (isAllCaps(ln)) {
            score -= 20;
        } else if (isTitleCase(ln)) {
            score += 25;
        }

        // Penalty for quotes, parentheses, brackets
        if (fn.contains("\"") || fn.contains("'") || fn.contains("(") || fn.contains(")")) score -= 30;
        if (ln.contains("\"") || ln.contains("'") || ln.contains("(") || ln.contains(")")) score -= 30;

        // Bonus for preserving real accents/diacritics (e.g. Pérez, Franquin)
        if (containsDiacritics(fn)) score += 15;
        if (containsDiacritics(ln)) score += 15;

        return score;
    }

    private static boolean isAllCaps(String s) {
        if (s == null || s.isBlank()) return false;
        boolean hasLetter = false;
        for (char c : s.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
                if (!Character.isUpperCase(c)) return false;
            }
        }
        return hasLetter;
    }

    private static boolean isTitleCase(String s) {
        if (s == null || s.isBlank()) return false;
        String[] words = s.split("\\s+");
        for (String w : words) {
            if (w.isEmpty()) continue;
            if (w.equalsIgnoreCase("iv") || w.equalsIgnoreCase("iii") || w.equalsIgnoreCase("ii") || w.equalsIgnoreCase("jr")) {
                continue;
            }
            if (!Character.isUpperCase(w.charAt(0))) return false;
            if (w.length() > 1 && isAllCaps(w)) return false;
        }
        return true;
    }

    private static boolean containsDiacritics(String s) {
        if (s == null) return false;
        String n = Normalizer.normalize(s, Normalizer.Form.NFD);
        return n.matches(".*\\p{M}.*");
    }

    /**
     * Finds an existing author matching by exact name, inverted name, or token key.
     */
    public Optional<AuthorEntity> findExistingDuplicate(String firstname, String lastname) {
        String fn = firstname != null ? firstname.trim() : "";
        String ln = lastname != null ? lastname.trim() : "";

        // 1. Direct exact match
        Optional<AuthorEntity> exact = authorRepository.findByFirstnameIgnoreCaseAndLastnameIgnoreCase(fn, ln);
        if (exact.isPresent()) {
            return exact;
        }

        // 2. Direct inverted match
        if (!fn.isEmpty() && !ln.isEmpty()) {
            Optional<AuthorEntity> inverted = authorRepository.findByFirstnameIgnoreCaseAndLastnameIgnoreCase(ln, fn);
            if (inverted.isPresent()) {
                return inverted;
            }
        }

        // 3. Token-based match across all authors
        String targetKey = computeTokenKey(fn, ln);
        if (targetKey.isEmpty()) {
            return Optional.empty();
        }

        List<AuthorEntity> allAuthors = authorRepository.findAll();
        for (AuthorEntity existing : allAuthors) {
            String existingKey = computeTokenKey(existing.getFirstname(), existing.getLastname());
            if (targetKey.equals(existingKey)) {
                return Optional.of(existing);
            }
        }

        return Optional.empty();
    }

    /**
     * Resolves an author by finding an existing record (even with inverted/variant names)
     * or creating a new one if none exists. If the incoming name has better formatting,
     * updates the existing record with the superior name.
     */
    @Transactional
    public AuthorEntity findOrCreateAuthor(String firstname, String lastname) {
        String fn = firstname != null ? firstname.trim() : "";
        String ln = lastname != null ? lastname.trim() : "";

        // If lastname is empty and firstname has multiple words, split
        if (ln.isEmpty() && !fn.isEmpty()) {
            int lastSpace = fn.lastIndexOf(' ');
            if (lastSpace > 0) {
                ln = fn.substring(lastSpace + 1).trim();
                fn = fn.substring(0, lastSpace).trim();
            } else {
                ln = fn;
                fn = "";
            }
        }

        Optional<AuthorEntity> existingOpt = findExistingDuplicate(fn, ln);
        if (existingOpt.isPresent()) {
            AuthorEntity existing = existingOpt.get();
            int incomingScore = calculateNameQualityScore(fn, ln);
            int existingScore = calculateNameQualityScore(existing.getFirstname(), existing.getLastname());
            if (incomingScore > existingScore) {
                log.info("Upgrading author #{} name from '{} {}' to '{} {}'",
                        existing.getId(), existing.getFirstname(), existing.getLastname(), fn, ln);
                existing.setFirstname(fn);
                existing.setLastname(ln);
                return authorRepository.save(existing);
            }
            return existing;
        }

        AuthorEntity newAuthor = new AuthorEntity();
        newAuthor.setFirstname(fn);
        newAuthor.setLastname(ln);
        return authorRepository.save(newAuthor);
    }

    /**
     * Scans the database for duplicate authors (inverted firstname/lastname, casing differences, punctuation),
     * merges all books and followers to the canonical author, and removes duplicate author records.
     */
    @Transactional
    public Map<String, Object> deduplicateAllAuthors() {
        log.info("Starting author deduplication pass...");
        List<AuthorEntity> allAuthors = authorRepository.findAll();

        // Group authors by normalized token key
        Map<String, List<AuthorEntity>> grouped = new HashMap<>();
        for (AuthorEntity a : allAuthors) {
            String key = computeTokenKey(a.getFirstname(), a.getLastname());
            if (!key.isEmpty()) {
                grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(a);
            }
        }

        // Get book counts per author
        Map<Integer, Integer> bookCounts = new HashMap<>();
        List<Map<String, Object>> bRows = jdbcTemplate.queryForList(
                "SELECT author_id, COUNT(*) as cnt FROM book_has_author GROUP BY author_id;"
        );
        for (Map<String, Object> row : bRows) {
            Number aId = (Number) row.get("author_id");
            Number cnt = (Number) row.get("cnt");
            if (aId != null && cnt != null) {
                bookCounts.put(aId.intValue(), cnt.intValue());
            }
        }

        // Get follower counts per author
        Map<Integer, Integer> followerCounts = new HashMap<>();
        List<Map<String, Object>> fRows = jdbcTemplate.queryForList(
                "SELECT author_id, COUNT(*) as cnt FROM user_follows_author GROUP BY author_id;"
        );
        for (Map<String, Object> row : fRows) {
            Number aId = (Number) row.get("author_id");
            Number cnt = (Number) row.get("cnt");
            if (aId != null && cnt != null) {
                followerCounts.put(aId.intValue(), cnt.intValue());
            }
        }

        int duplicateGroupsCount = 0;
        int mergedAuthorsCount = 0;
        List<String> mergeDetails = new ArrayList<>();

        for (Map.Entry<String, List<AuthorEntity>> entry : grouped.entrySet()) {
            List<AuthorEntity> group = entry.getValue();
            if (group.size() <= 1) {
                continue;
            }

            duplicateGroupsCount++;

            // Sort authors in group: highest score first
            group.sort((a1, a2) -> {
                int s1 = calculateNameQualityScore(a1.getFirstname(), a1.getLastname())
                        + bookCounts.getOrDefault(a1.getId(), 0) * 5
                        + followerCounts.getOrDefault(a1.getId(), 0) * 5;
                int s2 = calculateNameQualityScore(a2.getFirstname(), a2.getLastname())
                        + bookCounts.getOrDefault(a2.getId(), 0) * 5
                        + followerCounts.getOrDefault(a2.getId(), 0) * 5;
                if (s1 != s2) return Integer.compare(s2, s1);
                return Integer.compare(a1.getId(), a2.getId());
            });

            AuthorEntity canonical = group.get(0);

            // Check if any other author in the group had a cleaner name representation
            for (int i = 1; i < group.size(); i++) {
                AuthorEntity dup = group.get(i);
                if (calculateNameQualityScore(dup.getFirstname(), dup.getLastname()) >
                    calculateNameQualityScore(canonical.getFirstname(), canonical.getLastname())) {
                    canonical.setFirstname(dup.getFirstname());
                    canonical.setLastname(dup.getLastname());
                    authorRepository.save(canonical);
                }
            }

            // Merge each duplicate into canonical
            for (int i = 1; i < group.size(); i++) {
                AuthorEntity dup = group.get(i);
                mergeAuthorRecords(dup.getId(), canonical.getId());
                mergedAuthorsCount++;
                mergeDetails.add(String.format("'%s %s' (#%d) fusionne dans '%s %s' (#%d)",
                        dup.getFirstname(), dup.getLastname(), dup.getId(),
                        canonical.getFirstname(), canonical.getLastname(), canonical.getId()));
            }
        }

        log.info("Author deduplication pass completed: {} duplicate groups, {} authors merged.",
                duplicateGroupsCount, mergedAuthorsCount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("groups_processed", duplicateGroupsCount);
        result.put("merged_authors", mergedAuthorsCount);
        result.put("details", mergeDetails);
        result.put("message", mergedAuthorsCount > 0
                ? String.format("%d auteur%s en double fusionne%s avec succes.",
                        mergedAuthorsCount, mergedAuthorsCount > 1 ? "s" : "", mergedAuthorsCount > 1 ? "s" : "")
                : "Aucun auteur en double detecte.");
        return result;
    }

    private void mergeAuthorRecords(Integer fromAuthorId, Integer toAuthorId) {
        if (fromAuthorId == null || toAuthorId == null || fromAuthorId.equals(toAuthorId)) {
            return;
        }

        // 1. In book_has_author: remove duplicates that would violate unique constraint
        jdbcTemplate.update("""
            DELETE FROM book_has_author
            WHERE author_id = ?
              AND (book_id, author_type_id) IN (
                  SELECT book_id, author_type_id FROM book_has_author WHERE author_id = ?
              );
        """, fromAuthorId, toAuthorId);

        // 2. Re-point remaining book_has_author links
        jdbcTemplate.update("UPDATE book_has_author SET author_id = ? WHERE author_id = ?;", toAuthorId, fromAuthorId);

        // 3. In user_follows_author: remove duplicate followers
        jdbcTemplate.update("""
            DELETE FROM user_follows_author
            WHERE author_id = ?
              AND user_id IN (
                  SELECT user_id FROM user_follows_author WHERE author_id = ?
              );
        """, fromAuthorId, toAuthorId);

        // 4. Re-point remaining follower links
        jdbcTemplate.update("UPDATE user_follows_author SET author_id = ? WHERE author_id = ?;", toAuthorId, fromAuthorId);

        // 5. Delete the duplicate author
        jdbcTemplate.update("DELETE FROM author WHERE id = ?;", fromAuthorId);
    }
}
