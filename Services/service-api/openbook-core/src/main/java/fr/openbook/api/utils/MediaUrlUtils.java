package fr.openbook.api.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class MediaUrlUtils {

    private static final Pattern UUID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private static String publicUrl = "/images";

    @Value("${media.public.url:/images}")
    public void setPublicUrl(String url) {
        if (url != null && !url.isBlank()) {
            MediaUrlUtils.publicUrl = url.trim().replaceAll("/+$", "");
        }
    }

    public static String formatCoverUrl(String cover) {
        if (cover == null || cover.isBlank()) {
            return null;
        }
        String trimmed = cover.trim();
        if (UUID_PATTERN.matcher(trimmed).matches()) {
            return publicUrl + "/" + trimmed + "/blob";
        }
        return trimmed;
    }
}
