import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm";
import { Series } from "./series.entity";
import { Editor } from "./editor.entity";

@Entity({
    name: "book"
})
@Index("idx_book_series_id", ["series"])
@Index("idx_book_editor_id", ["editor"])
@Index("idx_book_release_date", ["release_date"])
@Index("idx_book_price", ["price"])
export class Book {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    page_count: number;

    @Column({ nullable: true })
    volume: number;

    @Column({ nullable: true })
    weight: number;

    @Column({ nullable: true })
    price: number;

    @ManyToOne(() => Series, series => series.id)
    @JoinColumn({ name: "series_id" })
    series: Series;

    @ManyToOne(() => Editor, editor => editor.id)
    @JoinColumn({ name: "editor_id" })
    editor: Editor;

    @Column()
    release_date: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}