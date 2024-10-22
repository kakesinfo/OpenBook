up:
	docker compose up --build

down:
	docker compose down

fclean:
	rm -rf postgresql-data

re: down fclean up

.PHONY: up down fclean re