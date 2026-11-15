package fr.openbook.api.bnf;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BnfSearchResult {
    private String title;
    private String isbn = "";
    private Integer price;
    private String coverUrl = "";
    private String seriesName;
    private Integer volume;
    private String editorName;
    private String collectionName;
    private Integer pageCount;
    private String releaseDate;
    private String description;
    private String docType;
    private Integer height;
    private Integer length;
    private Integer thickness;
    private List<BnfAuthor> authors = new ArrayList<>();

    @Data
    public static class BnfAuthor {
        private String firstname = "";
        private String lastname = "";
        private String type = "Writer";

        public BnfAuthor() {}

        public BnfAuthor(String firstname, String lastname, String type) {
            this.firstname = firstname != null ? firstname : "";
            this.lastname = lastname != null ? lastname : "";
            this.type = type != null ? type : "Writer";
        }
    }
}
