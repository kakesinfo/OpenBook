import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique, PrimaryColumn
} from "typeorm";
import { Series } from "./series.entity";
import { Theme } from "./theme.entity";

@Entity({
    name: "series_has_theme"
})
@Unique(["series", "theme"])
export class SeriesHasTheme {
    @PrimaryGeneratedColumn()
    id: number;

    @PrimaryColumn()
    series_id: number;

    @PrimaryColumn()
    theme_id: number;

    @ManyToOne(() => Series, series => series.id)
    @JoinColumn({ name: "series_id" })
    series: Series;

    @ManyToOne(() => Theme, theme => theme.id)
    @JoinColumn({ name: "theme_id" })
    theme: Theme;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}