import './LogBookCard.scss';
import { useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faUserPen } from "@fortawesome/free-solid-svg-icons";
import AuthorDTO from "../../dto/Author.dto.ts";
import useLanguage from "../../hooks/UseLanguage.tsx";

type Props = {
    author: AuthorDTO;
    onClose?: () => void;
};

export default function LogAuthorCard({ author, onClose }: Props) {
    const navigate = useNavigate();
    const { tr } = useLanguage();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClose?.();
        navigate(`/app/author/${author.id}`);
    };

    const fullName = [author.firstname, author.lastname].filter(Boolean).join(" ");

    return (
        <li className="logbook-card" onClick={handleClick}>
            <div className="logbook-card__thumbnail logbook-card__thumbnail--avatar">
                <FontAwesomeIcon icon={faUserPen} />
            </div>

            <div className="logbook-card__content">
                <span className="logbook-card__badge logbook-card__badge--author">
                    {tr("Author", "Auteur")}
                </span>
                <h4 className="logbook-card__title" title={fullName}>
                    {fullName}
                </h4>
                {author.booksCount !== undefined && author.booksCount > 0 && (
                    <div className="logbook-card__meta">
                        <span className="logbook-card__date">
                            {author.booksCount} {tr(author.booksCount > 1 ? "books" : "book", `album${author.booksCount > 1 ? "s" : ""}`)}
                        </span>
                    </div>
                )}
            </div>

            <div className="logbook-card__action">
                <span className="logbook-card__arrow">
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </div>
        </li>
    );
}
