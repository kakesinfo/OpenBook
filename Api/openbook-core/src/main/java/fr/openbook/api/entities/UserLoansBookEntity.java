package fr.openbook.api.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Date;

@Getter
@Setter
@Entity(name = "user_loans_book")
public class UserLoansBookEntity {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @NotFound(action = NotFoundAction.IGNORE)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "book_id", nullable = false)
    private BookEntity book;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "type", nullable = false, length = 20)
    private String type; // "BORROWED" or "LENT"

    @Column(name = "person_name", length = 150)
    private String personName;

    @Column(name = "loan_date")
    private LocalDate loanDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date().toInstant();
        updatedAt = new Date().toInstant();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date().toInstant();
    }
}
