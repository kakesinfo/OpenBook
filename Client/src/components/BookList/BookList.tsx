import BookSummaryDTO from "../../dto/BookSummary.dto.ts";

import "./BookList.scss";
import {Link} from "react-router";

export default function BookList({books}: { books: BookSummaryDTO[] }) {
	return <div className="booklist">
		{books.map((book) => (
			<Link to={`/app/book/${book.id}`} className="booklist-book" key={book.id}>
				<img className="booklist-book_cover" src={book.coverUrl} alt={`${book.title} cover`} />
				<div className="booklist-book_info">
					<h3 className="booklist-book_title">{book.title}</h3>
					<p className="booklist-book_volume">{book.volume > 0 ? `Tome ${book.volume}` : `Tome unique`}</p>
				</div>
			</Link>
		))}		
	</div>
}
