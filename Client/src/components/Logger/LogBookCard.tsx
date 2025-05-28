import './LogBookCard.scss'
import FormGroup from "../Form/FormGroup.tsx";
import {Link} from "react-router";

export default function LogBookCard({book}: { book: any }) {
    return (
        <div className="logbook-card">
            <div className="logbook-card__left">
                <h2>{book.title} #{book.volume}</h2>
                <small>{new Date(book.releaseDate).toLocaleDateString()}</small>

            </div>
            <div className="logbook-card__right">
                <FormGroup>
                    <Link to={`/book/${book.id}`} className="form-button">Voir</Link>
                </FormGroup>
            </div>
        </div>
    );
}