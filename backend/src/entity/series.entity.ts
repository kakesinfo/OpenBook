import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn, ManyToMany, JoinTable
} from "typeorm"
import {SeriesStatus} from "../enum/SeriesStatus";
import {Category} from "./category.entity";
import {Theme} from "./theme.entity";

@Entity({
    name: "series"
})
export class Series {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    name: string

    @Column({
        type: "enum",
        enum: SeriesStatus,
        default: SeriesStatus.ANNOUNCED
    })
    status: SeriesStatus

    @ManyToOne(() => Category, category => category.id)
    @JoinColumn({ name: "category_id" })
    category: Category

    @ManyToMany(() => Theme)
    @JoinTable({
        name: "series_has_theme",
        joinColumn: { name: "series_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "theme_id", referencedColumnName: "id" }
    })
    themes: Theme[];

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}