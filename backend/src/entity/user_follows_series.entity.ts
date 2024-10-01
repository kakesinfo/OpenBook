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
import { Series } from "./series.entity";

@Entity({
    name: "user_follows_series"
})
@Unique(["user_id", "series_id"])
@Index("idx_user_follows_series_user_id", ["user_id"])
@Index("idx_user_follows_series_series_id", ["series_id"])
@Index("idx_user_follows_series_created_at", ["created_at"])
export class UserFollowsSeries {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    series_id: number;

    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ManyToOne(() => Series, series => series.id)
    @JoinColumn({ name: "series_id" })
    series: Series;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}