// backend/src/entity/user_has_book.entity.ts
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
import { UserHasBookStatus } from "../enum/UserHasBookStatus";

@Entity({
    name: "user_has_book"
})
@Unique(["user_id", "book_id"])
@Index("idx_user_has_book_user_id", ["user_id"])
@Index("idx_user_has_book_book_id", ["book_id"])
@Index("idx_user_has_book_created_at", ["created_at"])
export class UserHasBook {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: "enum",
        enum: UserHasBookStatus,
        default: UserHasBookStatus.WISHLISTED
    })
    status: UserHasBookStatus;

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