up:
	docker compose up --build

up-frontend:
	docker compose up --force-recreate --build -d project-frontend

up-backend:
	docker compose up --force-recreate --build -d project-backend

up-scraper:
	docker compose up --force-recreate --build -d project-scraper

up-liquibase:
	docker compose up --force-recreate --build -d project-liquibase

up-postgres:
	docker compose up --force-recreate --build -d project-postgres

scrape-now:
	docker compose exec project-scraper /app/scraper-service --now

scrape-full:
	docker compose exec project-scraper /app/scraper-service --now --full

scrape-repair:
	docker compose exec project-scraper /app/scraper-service --repair

scraper-status:
	curl -s http://localhost:5001/api/status

down:
	docker compose down

fclean:
	rm -rf Cache/postgresql-data
	rm -rf Cache/service-api/.m2
	rm -rf Services/backend/target

re: down fclean up

.PHONY: up up-frontend up-backend up-scraper up-liquibase up-postgres scrape-now scrape-full scrape-repair scraper-status down fclean re
