import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm";
import { UserReadsBook } from "./user_reads_book.entity";

@Entity({
    name: "reading_session"
})
@Index("idx_reading_session_user_reads_book_id_id", ["user_reads_book_id"])
@Index("idx_reading_session_start_date", ["start_date"])
export class ReadingSession {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_reads_book_id: number;

    @ManyToOne(() => UserReadsBook, userReadsBook => userReadsBook.id)
    @JoinColumn({ name: "user_reads_book_id" })
    userReadsBook: UserReadsBook;

    @Column()
    start_date: Date;

    @Column({ nullable: true })
    end_date: Date;

    @Column()
    pages_reached: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}