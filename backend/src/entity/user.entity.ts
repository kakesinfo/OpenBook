import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    ManyToOne
} from "typeorm"
import {Image} from "./image.entity";

@Entity({
    name: "user"
})
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true})
    username: string

    @Column({ nullable: true })
    firstname: string

    @Column({ nullable: true })
    lastname: string

    @Column({ unique: true })
    email: string

    @Column()
    password: string

    @ManyToOne(() => Image, image => image.id)
    @JoinColumn({ name: "avatar_id" })
    avatar: Image

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}