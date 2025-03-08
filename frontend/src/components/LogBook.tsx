import {Dialog, DialogContent, DialogTitle, Fab} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {useState} from "react";
import TextField from "@mui/material/TextField";

export default function LogBook() {
    const [open, setOpen] = useState(false);

    const handleOpen = () => {
        setOpen(true);
    }

    const handleClose = () => {
        setOpen(false);
    }

    return (
        <>
            <Fab
                onClick={handleOpen}
                color="primary"
                sx={{position: "fixed", right: "20px", bottom: "20px"}}>
                <AddIcon />
            </Fab>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>Ajouter un livre</DialogTitle>
                <DialogContent  sx={{width: "500px"}}>
                    <TextField
                        autoFocus
                        required
                        fullWidth
                        margin="dense"
                        id="bookName"
                        name="bookName"
                        label="Nom du livre, auteur, maison d'edition, etc"
                        type="text"
                        variant="standard"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}