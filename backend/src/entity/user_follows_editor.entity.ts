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
import { Editor } from "./editor.entity";

@Entity({
    name: "user_follows_editor"
})
@Unique(["user_id", "editor_id"])
@Index("idx_user_follows_editor_user_id", ["user_id"])
@Index("idx_user_follows_editor_editor_id", ["editor_id"])
@Index("idx_user_follows_editor_created_at", ["created_at"])
export class UserFollowsEditor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    editor_id: number;

    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Editor, editor => editor.id)
    @JoinColumn({ name: "editor_id" })
    editor: Editor;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}