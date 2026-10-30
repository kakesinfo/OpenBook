package fr.openbook.api.entities;

import java.io.Serializable;

public enum BookReadingStatus implements Serializable {
    UNREAD,
    TO_READ,
    READING,
    READ,
    ABANDONED;

    public static BookReadingStatus fromString(String value) {
        if (value == null) return null;
        String normalized = value.trim().toUpperCase()
                .replace(" ", "_")
                .replace("É", "E")
                .replace("È", "E")
                .replace("À", "A");
        return switch (normalized) {
            case "READ", "LU" -> READ;
            case "READING", "EN_COURS", "EN_COURS_DE_LECTURE" -> READING;
            case "TO_READ", "PILE_A_LIRE", "PAL", "A_LIRE" -> TO_READ;
            case "UNREAD", "NON_LU" -> UNREAD;
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
