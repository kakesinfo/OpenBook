CACHE_DIRS = Cache/postgresql-data Cache/service-api/.m2 Cache/media-data

init-cache:
	@mkdir -p $(CACHE_DIRS)

up: init-cache
	docker compose up --build

up-frontend:
	docker compose up --force-recreate --build -d project-frontend

up-backend: init-cache
	docker compose up --force-recreate --build -d project-backend

up-import: init-cache
	docker compose up --force-recreate --build -d project-backend

up-media: init-cache
	docker compose up --force-recreate --build -d project-backend

up-postgres: init-cache
	docker compose up --force-recreate --build -d project-postgres

down:
	docker compose down

restart:
	docker compose restart

fclean:
	rm -rf Cache
	rm -rf Services/service-api/*/target

re: down init-cache up

.PHONY: init-cache up up-frontend up-backend up-import up-media up-postgres down restart fclean re
