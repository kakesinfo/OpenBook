import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
    Index
} from "typeorm";
import { Book } from "./book.entity";
import { Author } from "./author.entity";
import { AuthorType } from "./author_type.entity";

@Entity({
    name: "book_has_author"
})
@Unique(["book_id", "author_id", "author_type_id"])
@Index("idx_book_has_author_book_id", ["book_id"])
@Index("idx_book_has_author_author_id", ["author_id"])
export class BookHasAuthor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    book_id: number;

    @Column()
    author_id: number;

    @Column()
    author_type_id: number;

    @ManyToOne(() => Book, book => book.id)
    @JoinColumn({ name: "book_id" })
    book: Book;

    @ManyToOne(() => Author, author => author.id)
    @JoinColumn({ name: "author_id" })
    author: Author;

    @ManyToOne(() => AuthorType, authorType => authorType.id)
    @JoinColumn({ name: "author_type_id" })
    authorType: AuthorType;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}