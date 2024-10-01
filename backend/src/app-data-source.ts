import { DataSource } from "typeorm"

export const myDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "strapi",
    password: "strapi",
    database: "strapi",
    entities: ["dist/entity/*.js"],
    logging: true,
    synchronize: true,
})