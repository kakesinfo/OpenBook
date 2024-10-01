import * as express from "express";
import { Request, Response } from "express";

import {myDataSource} from "../app-data-source";
import {User} from "../entity/user.entity";

const UserController = express.Router()


// register routes
UserController.get("/users", async function (req: Request, res: Response) {
    const users = await myDataSource.getRepository(User).find()
    res.json(users)
})

UserController.get("/users/:id", async (req: Request, res: Response) => {
    const results = await myDataSource.getRepository(User).findOneBy({
        id: parseInt(req.params.id),
    });
    res.send(results)
})

UserController.post("/users", async function (req: Request, res: Response) {
    try {
        const user: User[] = myDataSource.getRepository(User).create(req.body);
        const results = await myDataSource.getRepository(User).save(user);
        res.json(results)
    } catch (error) {
        res.status(500).json(error.detail)
    }
})

UserController.put("/users/:id", async function (req: Request, res: Response) {
    try {
        const user = await myDataSource.getRepository(User).findOneBy({
            id: parseInt(req.params.id),
        })
        myDataSource.getRepository(User).merge(user, req.body)
        const results = await myDataSource.getRepository(User).save(user)
        res.send(results)
    } catch (error) {
        res.status(500).json(error.detail)
    }
})

UserController.delete("/users/:id", async function (req: Request, res: Response) {
    try {
        const results = await myDataSource.getRepository(User).delete(req.params.id)
        res.send(results)
    } catch (error) {
        res.status(500).json(error.detail)
    }
})

export default UserController;