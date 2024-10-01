import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Unique, Index
} from "typeorm"
import {Image} from "./image.entity";

@Entity({
    name: "author"
})
@Unique(["firstname", "lastname"])
@Index(["firstname", "lastname"], { unique: true })
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