import * as express from "express"
import { myDataSource } from "./app-data-source"
import UserController from "./controller/user.controller";

// establish database connection
myDataSource
    .initialize()
    .then(() => {
        console.log("Data Source has been initialized!")
    })
    .catch((err) => {
        console.error("Error during Data Source initialization:", err)
    })

// create and setup express app
const app = express()
app.use(express.json())

const defaultRouter = express.Router()

defaultRouter.use(UserController)

app.use("/api", defaultRouter)

// start express server
app.listen(3000)