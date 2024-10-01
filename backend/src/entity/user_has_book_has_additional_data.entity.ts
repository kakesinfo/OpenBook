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
import { UserHasBook } from "./user_has_book.entity";

@Entity({
    name: "user_has_book_has_additional_data"
})
@Unique(["user_has_book_id", "key"])
@Index("idx_user_has_book_has_additional_data_user_has_book_id", ["user_has_book_id"])
@Index("idx_user_has_book_has_additional_data_key", ["key"])
export class UserHasBookHasAdditionalData {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    key: string;

    @Column({ nullable: true })
    value: string;

    @Column()
    user_has_book_id: number;

    @ManyToOne(() => UserHasBook, userHasBook => userHasBook.id)
    @JoinColumn({ name: "user_has_book_id" })
    userHasBook: UserHasBook;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}