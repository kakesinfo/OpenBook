package fr.openbook.scraper.utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class VariantDetector {

    private static final Pattern RE_VARIANT_COVER = Pattern.compile(
            "\\b(?:couverture\\s+variante|variant(?:e)?(?:\\s+(?:panini|exclusive|site))?|couv\\.?\\s*var\\.?|(?:[eé]dition|coffret)\\s+collector|collector|[eé]dition\\s+sp[eé]ciale|[eé]dition\\s+limit[eé]e|[eé]dition\\s+prestige|tirage\\s+(?:limit[eé]|de\\s+t[eê]te)|(?:version|[eé]dition\\s+)?noir\\s+et\\s+blanc|n&b)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private static final Pattern RE_VARIANT_SUFFIX = Pattern.compile(
            "(?:\\s*[-\u2013\u2014:]\\s*|\\s+)\\(?(?:couverture\\s+variante|variant(?:e)?(?:\\s+(?:panini|exclusive|site))?|couv\\.?\\s*var\\.?|(?:[eé]dition|coffret)\\s+collector|collector|[eé]dition\\s+sp[eé]ciale|[eé]dition\\s+limit[eé]e|[eé]dition\\s+prestige|tirage\\s+(?:limit[eé]|de\\s+t[eê]te)|(?:version|[eé]dition\\s+)?noir\\s+et\\s+blanc|n&b)\\b[^\\)]*\\)?",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private static final Pattern RE_VARIANT_COVER_FILE = Pattern.compile("[a-zA-Z0-9]+v_\\d+\\.(?:jpg|jpeg|png|webp)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RE_VARIANT_SKU = Pattern.compile("[a-zA-Z0-9]+v(?:_[a-zA-Z0-9]+)?$", Pattern.CASE_INSENSITIVE);

    private static final Pattern RE_CANON_VOL_EXTRACT = Pattern.compile("(?:T(?:ome)?|Vol(?:ume)?|N°|#)\\s*0?(\\d+)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern RE_CANON_VOL_STRIP = Pattern.compile("(?:T(?:ome)?|Vol(?:ume)?|N°|#)\\s*0?\\d+.*", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    public record SeriesVolume(String series, Integer volume) {}

    private VariantDetector() {}

    public static boolean isVariantTitle(String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        return RE_VARIANT_COVER.matcher(title).find();
    }

    public static String stripVariantSuffix(String text) {
        String cleaned = TextCleaner.cleanText(text);
        if (cleaned.isBlank()) {
            return "";
        }
        String res = RE_VARIANT_SUFFIX.matcher(cleaned).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        if (res.endsWith("(") && countOccurrences(res, '(') > countOccurrences(res, ')')) {
            res = res.substring(0, res.length() - 1).replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }
        if (res.endsWith(")") && countOccurrences(res, ')') > countOccurrences(res, '(')) {
            res = res.substring(0, res.length() - 1).replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }
        return res.isBlank() ? cleaned : res;
    }

    public static boolean isVariantBook(String title, String coverUrl, String sku) {
        if (isVariantTitle(title)) {
            return true;
        }
        if (coverUrl != null && !coverUrl.isBlank() && RE_VARIANT_COVER_FILE.matcher(coverUrl).find()) {
            return true;
        }
        if (sku != null && !sku.isBlank() && RE_VARIANT_SKU.matcher(sku).find()) {
            return true;
        }
        return false;
    }

    public static SeriesVolume extractCanonicalSeriesAndVolume(String seriesOrTitle) {
        String cleaned = TextCleaner.cleanText(seriesOrTitle);
        Integer vol = null;

        Matcher m = RE_CANON_VOL_EXTRACT.matcher(cleaned);
        if (m.find()) {
            try {
                vol = Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {}
        }

        String base = RE_CANON_VOL_STRIP.matcher(cleaned).replaceAll("").replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        if (base.endsWith("(") && countOccurrences(base, '(') > countOccurrences(base, ')')) {
            base = base.substring(0, base.length() - 1).replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }
        if (base.endsWith(")") && countOccurrences(base, ')') > countOccurrences(base, '(')) {
            base = base.substring(0, base.length() - 1).replaceAll("^[ :\\-]+|[ :\\-]+$", "").trim();
        }
        base = stripVariantSuffix(base);
        if (base.isBlank()) {
            base = cleaned;
        }
        return new SeriesVolume(TextCleaner.cleanText(base), vol);
    }

    private static int countOccurrences(String s, char c) {
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) count++;
        }
        return count;
    }
}
