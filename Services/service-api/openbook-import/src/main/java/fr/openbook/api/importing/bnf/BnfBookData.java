package fr.openbook.api.importing.bnf;

import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
public class BnfBookData {
    private String isbn;
    private String title;
    private Integer volume;
    private Integer pageCount;
    private Instant releaseDate;
    private List<String> authors = new ArrayList<>();
    private String docType; // Roman, Manga, Bande dessinée, Comics
}
