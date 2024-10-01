import { Book } from '../entity/book.entity';
import {myDataSource} from "../app-data-source";
import {BookSummaryDTO} from "../dto/BookSummary.dto";

export class BookService {
    private bookRepository = myDataSource.getRepository(Book);

    async create(bookData: Partial<Book>): Promise<Book> {
        const book = this.bookRepository.create(bookData);
        return this.bookRepository.save(book);
    }

    async findAll(): Promise<Book[]> {
        return this.bookRepository.find();
    }

    async findOne(id: number): Promise<Book | undefined> {
        return this.bookRepository.createQueryBuilder("book")
            .leftJoinAndSelect("book.editor", "editor")
            .leftJoinAndSelect("book.bookHasImages", "book_has_image")
            .leftJoinAndSelect("book_has_image.image", "image")
            .leftJoinAndSelect("book.bookHasAuthors", "book_has_author")
            .leftJoinAndSelect("book_has_author.author", "author")
            .leftJoinAndSelect("book_has_author.authorType", "author_type")
            .where("book.id = :id", { id })
            .select([
                "book.id",
                "book.name",
                "book.page_count",
                "book.volume",
                "book.weight",
                "book.price",
                "book.release_date",
                "editor.id",
                "editor.name",
                "author.id",
                "author_type.id",
                "image.id",
                "image.url",
            ])
            .getOne()
    }

    async update(id: number, updateData: Partial<Book>): Promise<Book | undefined> {
        await this.bookRepository.update(id, updateData);
        return this.findOne(id);
    }

    async remove(id: number): Promise<void> {
        await this.bookRepository.delete(id);
    }
}