package fr.openbook.api.dtos;

import lombok.Data;

@Data
public class LoanBookRequestDTO {
    private String type; // "BORROWED" or "LENT"
    private String personName;
    private String loanDate; // ISO YYYY-MM-DD
    private String dueDate; // ISO YYYY-MM-DD
    private String memo;
}
