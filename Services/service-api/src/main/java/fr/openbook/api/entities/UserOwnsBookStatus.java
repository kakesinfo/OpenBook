package fr.openbook.api.entities;

import java.io.Serializable;

public enum UserOwnsBookStatus implements Serializable {
    WISHLISTED,
    OWNED,
    LENT,
    SOLD
}
