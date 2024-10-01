import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Unique
} from "typeorm"
import {Image} from "./image.entity";

@Entity({
    name: "author"
})
@Unique(["firstname", "lastname"])
export class Author {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    firstname: string

    @Column()
    lastname: string

    @Column()
    birthday: Date

    @OneToOne(() => Image, image => image.id)
    @JoinColumn({ name: "avatar_id" })
    avatar: Image

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}