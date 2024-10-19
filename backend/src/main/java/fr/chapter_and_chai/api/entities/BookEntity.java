package fr.chapter_and_chai.api.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.util.Date;

@Getter
@Setter
@Entity(name = "book")
public class BookEntity {
    @Id
    @Column(name = "id", nullable = false)
    private Integer id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "page_count")
    private Integer pageCount;

    @Column(name = "volume")
    private Integer volume;

    @Column(name = "weight")
    private Integer weight;

    @Column(name = "price")
    private Integer price;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.RESTRICT)
    @JoinColumn(name = "series_id", nullable = false)
    private SeriesEntity seriesEntity;

    @Column(name = "release_date", nullable = false)
    private Instant releaseDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate()
    {
        createdAt = new Date().toInstant();
        updatedAt = new Date().toInstant();
    }

    @PreUpdate
    protected void onUpdate()
    {
        updatedAt = new Date().toInstant();
    }
}