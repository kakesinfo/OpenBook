import useSession from "../../hooks/UseSession.tsx";

import "./BookPage.scss";

export default function CollectionPage(){
	const session = useSession();

	return <div className="collection-wrapper">
		<div className="collection-header"></div>

		<div className="collection-body">
			
		</div>
	</div>;
}
