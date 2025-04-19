package fr.openbook.api.dtos.user;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class UserProfileDTO implements Serializable
{
    private String username;

    private long booksCount;
    private long booksToReadCount;
    private long booksReadThisYearCount;
}
