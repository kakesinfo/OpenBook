import './LogBookCard.scss'
import FormGroup from "../Form/FormGroup.tsx";
import {useNavigate} from "react-router";

type Props = {
	book: any;
	onClose?: () => void; // le parent doit fournir cette fonction pour fermer la Dialog
}

export default function LogBookCard({book, onClose}: Props) {
	const navigate = useNavigate();
	
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		onClose?.(); 
		navigate(`/app/book/${book.id}`); // naviguer vers la page
	};
	
	return (
        <li className="logbook-card">
            <div className="logbook-card__left">
                <h2>{book.title} #{book.volume}</h2>
                <small>{new Date(book.releaseDate).toLocaleDateString()}</small>
            </div>
            <div className="logbook-card__right">
                <FormGroup>
                    <a href={`/app/book/${book.id}`}
					   onClick={handleClick}
					   className="form-button">Voir</a>
                </FormGroup>
            </div>
        </li>
    );
}
