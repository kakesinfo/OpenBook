import "./BookPage.scss";
import {WrapperHeader} from "../../components/Wrapper/Wrapper.tsx";
import {useEffect, useState} from "react";
import useSession from "../../hooks/UseSession.tsx";
import BookList from "../../components/BookList/BookList.tsx";
import BookSummaryDTO from "../../dto/BookSummary.dto.ts";

import "./HomePage.scss";

export default function HomePage(){
	const session = useSession();
	const [books, setBooks] = useState<BookSummaryDTO[]>([]);
	const [order, setOrder] = useState<"oldest" | "newest">("newest");
	
	useEffect(() => {
		session.customFetch(`/books/${order}`, {
			method: "GET"
		}).then(async (response) => {
			if (response.ok) {
				const data = await response.json();
				setBooks(data);
			}
		}).catch((err) => {
			console.error("HomePage fetch error:", err);
		});
	}, [order, session]);
	
	const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setOrder(e.target.value as "oldest" | "newest");
	}
	
	return <div className="newbooks-wrapper">
		<WrapperHeader>
			<h2>Nouveautés</h2>
			<button className="newbooks-order-button">
				<span>Trier par</span>
				<select value={order} onChange={handleOrderChange}>
					<option value="newest">Les plus récentes</option>
					<option value="oldest">Les plus anciennes</option>
				</select>
			</button>
		</WrapperHeader>

		<div className="newbooks-body">
			<BookList books={books} />
		</div>
	</div>;
}
