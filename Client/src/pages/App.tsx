import {Outlet} from "react-router";
import {
    Wrapper,
    WrapperAction,
    WrapperButton,
    WrapperContent,
    WrapperNavigation
} from "../components/Wrapper/Wrapper.tsx";
import { faNewspaper, faBook, faHeart, faCalendarDays, faChartSimple, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {useState} from "react";
import useSession from "../hooks/UseSession.tsx";
import {useDebounce} from "../hooks/UseDebounce.tsx";
import {Dialog} from "@mui/material";
import Card from "../components/Card/Card.tsx";
import FormGroup from "../components/Form/FormGroup.tsx";
import LogBookCard from "../components/Logger/LogBookCard.tsx";

export default function App(){
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [books, setBooks] = useState<any[]>([]);

    const session = useSession();

    const handleInit = () => {
        setSearch("");
        setBooks([]);
    }

    const handleOpen = () => {
        setOpen(true);
        handleInit();

        setTimeout(() => {
            const input = document.querySelector('input[name="bookName"]') as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 100);
    }

    const handleClose = () => {
        setOpen(false);
        handleInit();
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
    }

    useDebounce(search, 300, (value) => {
        const trimmedValue = value?.trim();
        if (!trimmedValue || trimmedValue.length === 0)
            return setBooks([]);

        session.customFetch(`http://localhost:8080/books/search/${value}`, {
            method: "GET",
        }).then(data => {
            if (data.ok) {
                data.json().then(setBooks);
            }
        })
    });

    return (
        <Wrapper>
            <WrapperNavigation title="OpenBook">
                <WrapperButton to={'/app/home'} icon={faNewspaper}>Nouveautés</WrapperButton>
                <WrapperButton to={'/app/collection'} icon={faBook}>Collection</WrapperButton>
                <WrapperButton to={'/app/wishlist'} icon={faHeart}>Souhaits</WrapperButton>
                <WrapperButton to={'/app/planning'} icon={faCalendarDays}>Planning</WrapperButton>
                <WrapperButton to={'/app/stats'} icon={faChartSimple}>Statistiques</WrapperButton>

                <WrapperAction icon={faMagnifyingGlass} callback={handleOpen}>Recherche</WrapperAction>
            </WrapperNavigation>
            <WrapperContent>
                <Outlet />
            </WrapperContent>

            <Dialog open={open} onClose={handleClose}
                    PaperProps={{
                        style: {
                            backgroundColor: "transparent",
                            boxShadow: "none",
                            minWidth: "500px",
                        }
                    }}>
                <Card>
                    <FormGroup>
                        <input
                            type="text"
                            name="bookName"
                            autoComplete="bookName"
                            onChange={handleChange}
                            placeholder="Nom du livre, auteur, maison d'edition, etc"
                        />
                    </FormGroup>
                    <ul>
                        {books.map((book) => (
                            <LogBookCard key={book.id} book={book} onClose={handleClose} />
                        ))}
                    </ul>
                </Card>
            </Dialog>
        </Wrapper>
    );
}
