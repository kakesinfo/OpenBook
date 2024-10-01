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
import { User } from "./user.entity";
import { Book } from "./book.entity";

@Entity({
    name: "user_reads_book"
})
@Unique(["user_id", "book_id", "iteration"])
@Index("idx_user_reads_book_book_id", ["book_id"])
@Index("idx_user_reads_book_user_id", ["user_id"])
@Index("idx_user_reads_book_created_at", ["created_at"])
export class UserReadsBook {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    start_date: Date;

    @Column({ nullable: true })
    end_date: Date;

    @Column({ default: 1 })
    iteration: number;

    @Column({ nullable: true })
    rating: number;

    @Column()
    user_id: number;

    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column()
    book_id: number;

    @ManyToOne(() => Book, book => book.id)
    @JoinColumn({ name: "book_id" })
    book: Book;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}