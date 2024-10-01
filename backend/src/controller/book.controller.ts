import * as express from "express";
import { Request, Response } from "express";

import {myDataSource} from "../app-data-source";
import {User} from "../entity/user.entity";
import {BookService} from "../service/book.service";

const BookController = express.Router()
const bookService = new BookService();

// register routes
BookController.get("/books", async function (req: Request, res: Response) {
    try {
        const books = await bookService.findAll();
        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

BookController.get("/books/:id", async (req: Request, res: Response) => {
    try {
        const book = await bookService.findOne(Number(req.params.id));
        if (book) {
            res.status(200).json(book);
        } else {
            res.status(404).json({ message: 'Book not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

BookController.post("/books", async function (req: Request, res: Response) {
    try {
        const book = await bookService.create(req.body);
        res.status(201).json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

BookController.put("/books/:id", async function (req: Request, res: Response) {
    try {
        const book = await bookService.update(Number(req.params.id), req.body);
        res.status(200).json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

BookController.delete("/books/:id", async function (req: Request, res: Response) {
    try {
        await bookService.remove(Number(req.params.id));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

export default BookController;