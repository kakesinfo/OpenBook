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
import { Author } from "./author.entity";

@Entity({
    name: "user_follows_author"
})
@Unique(["user_id", "author_id"])
@Index("idx_user_follows_author_user_id", ["user_id"])
@Index("idx_user_follows_author_author_id", ["author_id"])
@Index("idx_user_follows_author_created_at", ["created_at"])
export class UserFollowsAuthor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    author_id: number;

    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Author, author => author.id)
    @JoinColumn({ name: "author_id" })
    author: Author;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}