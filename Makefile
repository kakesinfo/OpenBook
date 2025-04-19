up:
	docker compose up --build

up-frontend:
	docker compose up --force-recreate --build -d project-frontend

up-backend:
	docker compose up --force-recreate --build -d project-backend

up-liquibase:
	docker compose up --force-recreate --build -d project-liquibase

up-postgres:
	docker compose up --force-recreate --build -d project-postgres

down:
	docker compose down

fclean:
	rm -rf Cache/postgresql-data
	rm -rf Cache/.m2
	rm -rf Services/backend/target

re: down fclean up

.PHONY: up down fclean re