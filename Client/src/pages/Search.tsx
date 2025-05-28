import Container from '../components/Container/Container.tsx';
import LogBook from '../components/Logger/LogBook.tsx';
import useSession from "../hooks/UseSession.tsx";
import {useEffect, useState} from "react";

export default function Search(){
    const session = useSession();

    const [books, setBooks] = useState<any[]>([]);

    useEffect(() => {
        const fetchBooks = async () => {
            const response = await session.customFetch("http://localhost:8080/books/search/Harry", {
                method: "GET"
            });

            if (response.ok) {
                return await response.json();
            }

            return [];
        }

        fetchBooks().then((data) => {
            setBooks(data);
        });
    }, []);

    return (
        <>
            <Container style={{maxWidth: "1000px", flexDirection: "row"}}>

                { books.map((book: any) => {
                    return (
                        <div key={book.id}>
                            <h1>{book.title}</h1>
                            <p>{book.author}</p>
                        </div>
                    );
                }) }

            </Container>

            <LogBook />
        </>
    );
}