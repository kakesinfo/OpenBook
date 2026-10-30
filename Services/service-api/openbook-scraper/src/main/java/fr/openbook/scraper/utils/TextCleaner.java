package fr.openbook.scraper.utils;

import org.jsoup.parser.Parser;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class TextCleaner {

    private static final Pattern RE_UNICODE_DASHES = Pattern.compile("[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]");
    private static final Pattern RE_SINGLE_QUOTES = Pattern.compile("[\u2018\u2019\u201a\u201b]");
    private static final Pattern RE_DOUBLE_QUOTES = Pattern.compile("[\u201c\u201d\u201e\u201f]");
    private static final Pattern RE_WHITESPACE = Pattern.compile("[ \t\u00a0\u2000-\u200b]+");

    private static final Pattern RE_AUTHOR_ROLE_PREFIX = Pattern.compile(
            "(?i)^(?:par\\s+|de\\s+|d['\u2019]|" +
            "texte\\s+et\\s+illustrations?\\s+(?:de\\s*)?|" +
            "sc[eé]nariste\\s+et\\s+dessinateur\\s*|" +
            "sc[eé]nario\\s+et\\s+dessin\\s+(?:de\\s*)?|" +
            "sc[eé]nario\\s+(?:de\\s*)?|" +
            "illustrations?\\s+(?:de\\s*)?|" +
            "dessins?\\s+(?:de\\s*)?|" +
            "auteurs?\\s*(?:\\+|/|et)\\s*illustrat(?:eur|rice)s?\\s*|" +
            "illustrat(?:eur|rice)s?\\s*|" +
            "dessinat(?:eur|rice)s?\\s*|" +
            "sc[eé]naristes?\\s*|" +
            "coloristes?\\s*|" +
            "auteurs?\\s*|" +
            "auteures?\\s*|" +
            "[\\+:\\-_/]\\s*)+"
    );

    private TextCleaner() {}

    /**
     * Cleans raw text:
     * - Unescapes HTML entities
     * - Repairs double-encoded UTF-8 / Mojibake
     * - Normalizes unicode quotes and dashes
     * - Collapses duplicate whitespace
     */
    public static String cleanText(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }

        String cleaned = Parser.unescapeEntities(text, false);

        if (cleaned.contains("Ã") || cleaned.contains("Â") || cleaned.contains("â€™") || cleaned.contains("â„¢")) {
            String repaired = tryDecodeLatin1AsUTF8(cleaned);
            if (repaired != null) {
                cleaned = repaired;
            }
        }

        cleaned = RE_UNICODE_DASHES.matcher(cleaned).replaceAll("-");
        cleaned = RE_SINGLE_QUOTES.matcher(cleaned).replaceAll("'");
        cleaned = RE_DOUBLE_QUOTES.matcher(cleaned).replaceAll("\"");
        cleaned = RE_WHITESPACE.matcher(cleaned).replaceAll(" ");

        return cleaned.trim();
    }

    private static String tryDecodeLatin1AsUTF8(String s) {
        byte[] bytes = new byte[s.length()];
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c > 255) {
                return null;
            }
            bytes[i] = (byte) c;
        }

        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);

        try {
            return decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            return null;
        }
    }

    /**
     * Removes role and descriptive prefixes from author names (e.g. "Scénario et dessin de John Doe" -> "John Doe").
     */
    public static String cleanAuthorName(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        String cleaned = cleanText(name);
        while (true) {
            Matcher m = RE_AUTHOR_ROLE_PREFIX.matcher(cleaned);
            if (m.find()) {
                String next = m.replaceAll("").replaceAll("^[ +:\\-_/]+|[ +:\\-_/]+$", "").trim();
                if (next.equals(cleaned)) {
                    break;
                }
                cleaned = next;
            } else {
                break;
            }
        }
        return cleaned.trim();
    }

    /**
     * Splits full author name into [firstname, lastname].
     * Handles mononyms (e.g. "RUN" -> ["", "RUN"]).
     */
    public static String[] splitAuthorName(String fullName) {
        String cleaned = cleanAuthorName(fullName);
        if (cleaned.isBlank()) {
            return new String[]{"", ""};
        }
        String[] parts = cleaned.split("\\s+");
        if (parts.length == 1) {
            return new String[]{"", parts[0]};
        }
        int firstSpace = cleaned.indexOf(' ');
        if (firstSpace == -1) {
            return new String[]{"", cleaned};
        }
        String first = cleaned.substring(0, firstSpace).trim();
        String last = cleaned.substring(firstSpace + 1).trim();
        return new String[]{first, last};
    }

    public static String truncate(String s, int maxLen) {
        if (s == null) return "";
        if (s.length() <= maxLen) return s;
        return s.substring(0, maxLen);
    }

    public static String capitalize(String s) {
        if (s == null || s.isBlank()) return "";
        String lower = s.toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    public static String titleCase(String s) {
        if (s == null || s.isBlank()) return "";
        return Arrays.stream(s.trim().split("\\s+"))
                .map(TextCleaner::capitalize)
                .collect(Collectors.joining(" "));
    }
}
