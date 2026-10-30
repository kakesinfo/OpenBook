package fr.openbook.api.entities;

import java.io.Serializable;

public enum UserOwnsBookStatus implements Serializable {
    WISHLISTED,
    OWNED,
    FOR_SALE,
    LENT,
    SOLD
}
