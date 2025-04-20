import LogBook from "../components/LogBook.tsx";
import {Outlet} from "react-router";
import {Wrapper, WrapperButton, WrapperContent, WrapperNavigation} from "../components/Wrapper/Wrapper.tsx";
import { faNewspaper, faBook, faHeart, faCalendarDays, faChartSimple, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

export default function Profile(){
    return (
        <Wrapper>
            <WrapperNavigation title="OpenBook">
                <WrapperButton to={'/profile/home'} icon={faNewspaper}>Nouveautés</WrapperButton>
                <WrapperButton to={'/profile/collection'} icon={faBook}>Collection</WrapperButton>
                <WrapperButton to={'/profile/wishlist'} icon={faHeart}>Souhaits</WrapperButton>
                <WrapperButton to={'/profile/planning'} icon={faCalendarDays}>Planning</WrapperButton>
                <WrapperButton to={'/profile/stats'} icon={faChartSimple}>Statistiques</WrapperButton>
                <WrapperButton to={'/profile/search'} icon={faMagnifyingGlass}>Recherche</WrapperButton>
            </WrapperNavigation>
            <WrapperContent>
                <Outlet />
            </WrapperContent>
            <LogBook />
        </Wrapper>
    );
}