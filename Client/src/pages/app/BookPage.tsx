import {useParams} from "react-router";
import {useEffect, useState} from "react";
import BookDTO from "../../dto/Book.dto";
import useSession from "../../hooks/UseSession.tsx";
import {getSeriesStatusLabel} from "../../dto/Series.dto.ts";

import "./BookPage.scss";

export default function BookPage(){
    const { id } = useParams<{ id?: string }>();

    const session = useSession();

    const [book, setBook] = useState<BookDTO | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        setLoading(true);
        setError(null);
        setBook(null);

        const fetchUrl = `http://localhost:8080/books/${encodeURIComponent(id)}?withCollection=0&withEditor=0&withAuthors=1`;
        session.customFetch(fetchUrl, {
            method: "GET",
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setBook(data);
            } else {
                const errorText = await response.text();
                setError(`Erreur ${response.status}: ${errorText}`);
            }
            setLoading(false);
        });

    }, []);

    return <div className="book-wrapper">
		<div className="book-header"></div>
		
		<div className="book-body">
			{loading && <p>Chargement...</p>}

			{error && <p style={{ color: 'red' }}>Erreur: {error}</p>}
			
			<div className="book-left">
				<div className="book-cover">
					{book && <img src={book.coverUrl} alt={`Couverture de ${book.title}`} />}
				</div>
			</div>
			
			<div className="book-right">
				<ul className="book-tags">
					{book && book.series && <li>{ getSeriesStatusLabel(book.series.status) }</li>}
					{book && book.series && <li>{book.volume}/{book.series.totalVolumes}</li>}
				</ul>
				
				<div className="book-informations">
					{book && book.series && <h1>{book.series.name}</h1>}
					{book && <h2>{book.title}</h2>}
					{book && <p>{book.description}</p>}
				</div>
				
				<nav className="book-actions">
					<button>Liste de souhait</button>
					<button>Ajouter à la collection</button>
					<button>Marquer comme lu</button>
				</nav>
				
				<div className="book-details">
					<strong>Détails techniques</strong>
					<ul>
						{book && book.releaseDate && <li><b>Date de sortie</b> {new Date(book.releaseDate).toLocaleDateString()}</li>}
						{book && book.isbn && <li><b>ISBN</b>{book.isbn}</li>}
						{book && (book.length || book.height || book.thickness) && <li><b>Dimensions</b>{book.length} x {book.height} x {book.thickness} mm</li>}
						{book && book.weight && <li><b>Poids</b>{book.weight} g</li>}
						{book && book.pageCount && <li><b>Pages</b>{book.pageCount}</li>}
						{book && book.price && <li><b>Prix</b>{book.price} €</li>}
					</ul>
				</div>
			</div>
		</div>
    </div>;
}
