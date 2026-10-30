package fr.openbook.scraper.utils;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class FrenchDateParser {

    private static final Map<String, Month> FRENCH_MONTHS = new HashMap<>();

    static {
        registerMonth(Month.JANUARY, "janvier", "janv.", "janv");
        registerMonth(Month.FEBRUARY, "février", "fevrier", "févr.", "févr", "fevr.", "fevr");
        registerMonth(Month.MARCH, "mars");
        registerMonth(Month.APRIL, "avril", "avr.", "avr");
        registerMonth(Month.MAY, "mai");
        registerMonth(Month.JUNE, "juin");
        registerMonth(Month.JULY, "juillet", "juil.", "juil");
        registerMonth(Month.AUGUST, "août", "aout");
        registerMonth(Month.SEPTEMBER, "septembre", "sept.", "sept");
        registerMonth(Month.OCTOBER, "octobre", "oct.", "oct");
        registerMonth(Month.NOVEMBER, "novembre", "nov.", "nov");
        registerMonth(Month.DECEMBER, "décembre", "decembre", "déc.", "déc", "dec.", "dec");
    }

    private static void registerMonth(Month month, String... names) {
        for (String name : names) {
            FRENCH_MONTHS.put(name.toLowerCase(), month);
        }
    }

    private static final Pattern RE_ISO_DATE = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
    private static final Pattern RE_SLASH_DATE = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{4})");
    private static final Pattern RE_FRENCH_DMY = Pattern.compile("(?i)(\\d{1,2})\\s+([a-zàâäéèêëîïôöùûüç\\.]+)\\s+(\\d{4})");
    private static final Pattern RE_FRENCH_MY = Pattern.compile("(?i)([a-zàâäéèêëîïôöùûüç\\.]+)\\s+(\\d{4})");

    private FrenchDateParser() {}

    /**
     * Parses dates in formats:
     * - "2024-10-24"
     * - "24/10/2024"
     * - "24 janvier 2025", "1er février 2025"
     * - "janvier 2025" (returns first day of month)
     */
    public static LocalDate parse(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        String cleaned = text.toLowerCase().trim()
                .replaceAll("(?i)\\b1er\\b", "1");

        Matcher iso = RE_ISO_DATE.matcher(cleaned);
        if (iso.find()) {
            try {
                int y = Integer.parseInt(iso.group(1));
                int m = Integer.parseInt(iso.group(2));
                int d = Integer.parseInt(iso.group(3));
                if (isValidDate(y, m, d)) {
                    return LocalDate.of(y, m, d);
                }
            } catch (Exception ignored) {}
        }

        Matcher slash = RE_SLASH_DATE.matcher(cleaned);
        if (slash.find()) {
            try {
                int d = Integer.parseInt(slash.group(1));
                int m = Integer.parseInt(slash.group(2));
                int y = Integer.parseInt(slash.group(3));
                if (isValidDate(y, m, d)) {
                    return LocalDate.of(y, m, d);
                }
            } catch (Exception ignored) {}
        }

        Matcher dmy = RE_FRENCH_DMY.matcher(cleaned);
        if (dmy.find()) {
            try {
                int d = Integer.parseInt(dmy.group(1));
                String mName = dmy.group(2).toLowerCase();
                int y = Integer.parseInt(dmy.group(3));
                Month month = FRENCH_MONTHS.get(mName);
                if (month != null && isValidDate(y, month.getValue(), d)) {
                    return LocalDate.of(y, month, d);
                }
            } catch (Exception ignored) {}
        }

        Matcher my = RE_FRENCH_MY.matcher(cleaned);
        if (my.find()) {
            try {
                String mName = my.group(1).toLowerCase();
                int y = Integer.parseInt(my.group(2));
                Month month = FRENCH_MONTHS.get(mName);
                if (month != null && y > 1900 && y < 2100) {
                    return LocalDate.of(y, month, 1);
                }
            } catch (Exception ignored) {}
        }

        return null;
    }

    private static boolean isValidDate(int y, int m, int d) {
        return y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }
}
