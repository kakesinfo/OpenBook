up:
	docker compose up --build

up-backend:
	docker-compose up --force-recreate --build -d project-backend

down:
	docker compose down

fclean:
	rm -rf postgresql-data

re: down fclean up

.PHONY: up down fclean re