import LogoutButton from "../components/LogoutButton.tsx";
import useSession from "../hooks/UseSession.tsx";
import {useEffect, useState} from "react";

export default function Profile(){
    const { customFetch } = useSession();

    const [ editors, setEditors ] = useState<any[]>([]);

    useEffect(() => {
        customFetch("http://localhost:8080/editors", {
            method: "GET",
        })
            .then(response => response.json())
            .then(data => setEditors(data))
            .catch(console.error);
    }, []);

    return (
        <>
            <h1>Profile</h1>
            <p>Here is your profile</p>
            <LogoutButton />

            <h2>Editors</h2>
            <ul>
                {editors.map(editor => (
                    <li key={editor.id}>{editor.name}</li>
                ))}
            </ul>
        </>
    );
}