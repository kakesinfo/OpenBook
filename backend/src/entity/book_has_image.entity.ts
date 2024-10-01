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
import { Image } from "./image.entity";

@Entity({
    name: "book_has_image"
})
@Unique(["book_id", "image_id"])
@Index("idx_book_has_image_book_id", ["book_id"])
@Index("idx_book_has_image_image_id", ["image_id"])
export class BookHasImage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    book_id: number;

    @Column()
    image_id: number;

    @ManyToOne(() => Book, book => book.id)
    @JoinColumn({ name: "book_id" })
    book: Book;

    @ManyToOne(() => Image, image => image.id)
    @JoinColumn({ name: "image_id" })
    image: Image;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}