package fr.openbook.api.services;

import fr.openbook.api.dtos.CalendarFeedDTO;
import fr.openbook.api.entities.AuthorEntity;
import fr.openbook.api.entities.BookEntity;
import fr.openbook.api.entities.UserEntity;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class CalendarIcsService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");
    private static final DateTimeFormatter BASIC_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE; // yyyyMMdd
    private static final DateTimeFormatter UTC_TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneId.of("UTC"));
    private static final DateTimeFormatter DISPLAY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public CalendarFeedDTO buildFeedDTO(String token, HttpServletRequest request) {
        String scheme = request.getScheme();
        String serverName = request.getServerName();
        int serverPort = request.getServerPort();
        String contextPath = request.getContextPath();

        // Check for X-Forwarded-Proto and X-Forwarded-Host if behind a reverse proxy
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        if (forwardedProto != null && !forwardedProto.isBlank()) {
            scheme = forwardedProto.split(",")[0].trim();
        }
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        String hostPart;
        if (forwardedHost != null && !forwardedHost.isBlank()) {
            hostPart = forwardedHost.split(",")[0].trim();
        } else {
            hostPart = serverName;
            if ((scheme.equalsIgnoreCase("http") && serverPort != 80) ||
                (scheme.equalsIgnoreCase("https") && serverPort != 443)) {
                hostPart += ":" + serverPort;
            }
        }

        String baseUrl = scheme + "://" + hostPart + (contextPath != null ? contextPath : "");
        String icsUrl = baseUrl + "/books/planning/calendar.ics?token=" + token;
        String webcalUrl = icsUrl.replaceFirst("^https?://", "webcal://");
        String googleCalendarUrl = "https://calendar.google.com/calendar/r?cid=" + URLEncoder.encode(webcalUrl, StandardCharsets.UTF_8);

        return CalendarFeedDTO.builder()
                .token(token)
                .icsUrl(icsUrl)
                .webcalUrl(webcalUrl)
                .googleCalendarUrl(googleCalendarUrl)
                .build();
    }

    public String generatePlanningIcs(UserEntity user, List<BookEntity> books) {
        StringBuilder sb = new StringBuilder();

        // VCALENDAR Header
        appendLine(sb, "BEGIN:VCALENDAR");
        appendLine(sb, "VERSION:2.0");
        appendLine(sb, "PRODID:-//Yet Another Library//OpenBook Planning//FR");
        appendLine(sb, "CALSCALE:GREGORIAN");
        appendLine(sb, "METHOD:PUBLISH");
        appendLine(sb, "X-WR-CALNAME:" + escapeIcsText("Planning Sorties - " + (user != null ? user.getUsername() : "OpenBook")));
        appendLine(sb, "X-WR-TIMEZONE:Europe/Paris");
        appendLine(sb, "X-WR-CALDESC:" + escapeIcsText("Planning des sorties de vos séries, auteurs et éditeurs suivis"));
        appendLine(sb, "REFRESH-INTERVAL;VALUE=DURATION:P1D");
        appendLine(sb, "X-PUBLISHED-TTL:P1D");

        String nowStamp = UTC_TIMESTAMP_FORMAT.format(Instant.now());

        if (books != null) {
            for (BookEntity book : books) {
                if (book.getReleaseDate() == null) continue;

                LocalDate releaseDate = book.getReleaseDate().atZone(DEFAULT_ZONE).toLocalDate();
                LocalDate endDate = releaseDate.plusDays(1);

                String dtStamp = book.getUpdatedAt() != null ? UTC_TIMESTAMP_FORMAT.format(book.getUpdatedAt()) : nowStamp;
                String uid = "openbook-book-" + book.getId() + "@openbook";

                appendLine(sb, "BEGIN:VEVENT");
                appendLine(sb, "UID:" + uid);
                appendLine(sb, "DTSTAMP:" + dtStamp);
                appendLine(sb, "DTSTART;VALUE=DATE:" + releaseDate.format(BASIC_DATE_FORMAT));
                appendLine(sb, "DTEND;VALUE=DATE:" + endDate.format(BASIC_DATE_FORMAT));

                // Summary / Title
                String summary = formatSummary(book);
                appendLine(sb, "SUMMARY:" + escapeIcsText(summary));

                // Description
                String description = formatDescription(book, releaseDate);
                appendLine(sb, "DESCRIPTION:" + escapeIcsText(description));

                // Category
                String category = resolveCategory(book);
                if (category != null && !category.isBlank()) {
                    appendLine(sb, "CATEGORIES:" + escapeIcsText(category));
                }

                appendLine(sb, "STATUS:CONFIRMED");
                appendLine(sb, "TRANSP:TRANSPARENT");
                appendLine(sb, "END:VEVENT");
            }
        }

        appendLine(sb, "END:VCALENDAR");

        return sb.toString();
    }

    private String formatSummary(BookEntity book) {
        StringBuilder title = new StringBuilder();
        if (book.getSeries() != null && book.getSeries().getName() != null && !book.getSeries().getName().isBlank()) {
            title.append(book.getSeries().getName());
            if (book.getVolume() != null) {
                title.append(", Tome ").append(book.getVolume());
            }
            if (book.getTitle() != null && !book.getTitle().isBlank()
                    && !book.getTitle().equalsIgnoreCase(book.getSeries().getName())
                    && !book.getTitle().equalsIgnoreCase("Tome " + book.getVolume())) {
                title.append(" - ").append(book.getTitle());
            }
        } else {
            title.append(book.getTitle() != null ? book.getTitle() : "Sortie livre");
        }
        return title.toString();
    }

    private String formatDescription(BookEntity book, LocalDate releaseDate) {
        StringBuilder desc = new StringBuilder();
        if (book.getTitle() != null && !book.getTitle().isBlank()) {
            desc.append("Titre : ").append(book.getTitle()).append("\n");
        }
        if (book.getSeries() != null && book.getSeries().getName() != null) {
            desc.append("Série : ").append(book.getSeries().getName());
            if (book.getVolume() != null) {
                desc.append(" (Tome ").append(book.getVolume()).append(")");
            }
            desc.append("\n");
        }
        if (book.getBookHasAuthors() != null && !book.getBookHasAuthors().isEmpty()) {
            String authors = book.getBookHasAuthors().stream()
                    .map(bha -> {
                        AuthorEntity a = bha.getAuthor();
                        if (a == null) return null;
                        String fn = a.getFirstname() != null ? a.getFirstname().trim() : "";
                        String ln = a.getLastname() != null ? a.getLastname().trim() : "";
                        return (fn + " " + ln).trim();
                    })
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .collect(Collectors.joining(", "));
            if (!authors.isBlank()) {
                desc.append("Auteur(s) : ").append(authors).append("\n");
            }
        }
        if (book.getEditor() != null && book.getEditor().getName() != null) {
            desc.append("Éditeur : ").append(book.getEditor().getName()).append("\n");
        }
        if (book.getCollection() != null && book.getCollection().getName() != null) {
            desc.append("Collection : ").append(book.getCollection().getName()).append("\n");
        }
        if (book.getIsbn() != null && !book.getIsbn().isBlank()) {
            desc.append("ISBN : ").append(book.getIsbn()).append("\n");
        }
        desc.append("Date de sortie : ").append(releaseDate.format(DISPLAY_DATE_FORMAT)).append("\n");
        if (book.getType() != null && !book.getType().isBlank()) {
            desc.append("Type : ").append(book.getType()).append("\n");
        }
        if (book.getDescription() != null && !book.getDescription().isBlank()) {
            desc.append("\nRésumé :\n").append(book.getDescription().strip());
        }
        return desc.toString();
    }

    private String resolveCategory(BookEntity book) {
        if (book.getSeries() != null && book.getSeries().getCategory() != null && book.getSeries().getCategory().getName() != null) {
            return book.getSeries().getCategory().getName();
        }
        return book.getType();
    }

    private void appendLine(StringBuilder sb, String line) {
        if (line.length() <= 75) {
            sb.append(line).append("\r\n");
            return;
        }
        int start = 0;
        while (start < line.length()) {
            int max = (start == 0) ? 75 : 74;
            int end = Math.min(start + max, line.length());
            if (start > 0) {
                sb.append("\r\n ");
            }
            sb.append(line, start, end);
            start = end;
        }
        sb.append("\r\n");
    }

    public static String escapeIcsText(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n")
                .replace("\r", "\\n");
    }
}
