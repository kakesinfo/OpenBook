package fr.openbook.api.entities;

import java.io.Serializable;

public enum BookReadingStatus implements Serializable {
    UNREAD,
    READING,
    READ,
    ABANDONED;

    public static BookReadingStatus fromString(String value) {
        if (value == null) return null;
        String normalized = value.trim().toUpperCase()
                .replace(" ", "_")
                .replace("É", "E")
                .replace("È", "E");
        return switch (normalized) {
            case "READ", "LU" -> READ;
            case "READING", "EN_COURS", "EN_COURS_DE_LECTURE" -> READING;
            case "UNREAD", "NON_LU", "A_LIRE" -> UNREAD;
            case "ABANDONED", "ABANDONNE" -> ABANDONED;
            default -> {
                for (BookReadingStatus status : values()) {
                    if (status.name().equalsIgnoreCase(normalized)) {
                        yield status;
                    }
                }
                throw new IllegalArgumentException("Unknown reading status: " + value);
            }
        };
    }
}
