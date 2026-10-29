package fr.openbook.api.importing.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BookmoryPurchase {
    @JsonProperty("from")
    private String from;

    @JsonProperty("price")
    private Double price;

    @JsonProperty("memo")
    private String memo;

    @JsonProperty("currency_code")
    private String currencyCode;

    @JsonProperty("purchased_at")
    private Long purchasedAt;

    @JsonProperty("created_at")
    private Long createdAt;

    @JsonProperty("updated_at")
    private Long updatedAt;
}
