import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany} from "typeorm"
import {Series} from "./series.entity";

@Entity({
    name: "theme"
})
export class Theme {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    name: string

    @ManyToMany(() => Series)
    series: Series[];

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}