import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from "typeorm"

@Entity({
    name: "editor"
})
export class Editor {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    name: string

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}