import {Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn} from "typeorm"

@Entity({
    name: "image"
})
export class Image {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    name: string

    @Column()
    url: string

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}