package fr.openbook.api.entities;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.util.Date;
import java.util.List;

@Getter
@Setter
@Entity(name = "book")
public class BookEntity {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "isbn", nullable = true)
    private String isbn;

    @Column(name = "volume")
    private Integer volume;

    @Column(name = "page_count")
    private Integer pageCount;

    @Column(name = "weight")
    private Integer weight;

    @Column(name = "height")
    private Integer height;

    @Column(name = "length")
    private Integer length;

    @Column(name = "thickness")
    private Integer thickness;

    @Column(name = "price")
    private Integer price;

    @Column(name = "description")
    private String description;

    @Column(name = "cover_url")
    private String coverUrl;

    @Column(name = "type")
    private String type;

    @Column(name = "origin_country")
    private String originCountry;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.RESTRICT)
    @JoinColumn(name = "series_id", nullable = false)
    private SeriesEntity series;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.RESTRICT)
    @JoinColumn(name = "collection_id", nullable = true)
    private CollectionEntity collection;

    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.RESTRICT)
    @JoinColumn(name = "editor_id", nullable = true)
    private EditorEntity editor;

    @OneToMany(mappedBy = "book", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookHasAuthorEntity> bookHasAuthors;

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
