package fr.openbook.api.services;

import fr.openbook.api.dtos.BookSummaryDTO;
import fr.openbook.api.entities.BookEntity;

import java.util.stream.Collectors;

public class BookMapper {
    public static BookSummaryDTO toSummaryDTO(BookEntity book) {
        if (book == null) {
            return null;
        }
        BookSummaryDTO dto = new BookSummaryDTO();
        dto.setId(book.getId());
        dto.setTitle(book.getTitle());
        dto.setVolume(book.getSeries() != null ? book.getVolume() : null);
        dto.setPrice(book.getPrice());
        if (book.getReleaseDate() != null) {
            dto.setReleaseDate(book.getReleaseDate().toString());
        }
        if (book.getCreatedAt() != null) {
            dto.setCreatedAt(book.getCreatedAt().toString());
        }
        dto.setCoverUrl(book.getCoverUrl());
        if (book.getSeries() != null) {
            dto.setSeriesId(book.getSeries().getId() != null ? book.getSeries().getId().longValue() : null);
            dto.setSeriesName(book.getSeries().getName());
            dto.setSeriesTotalVolumes(book.getSeries().getTotalVolumes());
            dto.setSeriesCoverUrl(book.getSeries().getCoverUrl());
            if (book.getSeries().getCategory() != null) {
                dto.setCategory(book.getSeries().getCategory().getName());
            }
        }
        dto.setPageCount(book.getPageCount());
        if (book.getBookHasAuthors() != null && !book.getBookHasAuthors().isEmpty()) {
            String authorStr = book.getBookHasAuthors().stream()
                    .filter(bha -> bha.getAuthor() != null)
                    .map(bha -> ((bha.getAuthor().getFirstname() != null ? bha.getAuthor().getFirstname() : "") + " "
                            + (bha.getAuthor().getLastname() != null ? bha.getAuthor().getLastname() : "")).trim())
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .collect(Collectors.joining(", "));
            dto.setAuthor(authorStr);
        }
        dto.setType(book.getType());
        return dto;
    }
}
