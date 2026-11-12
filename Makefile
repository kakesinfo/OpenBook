CACHE_DIRS = Cache/postgresql-data Cache/api/.m2 Cache/media-data

init-cache:
	@mkdir -p $(CACHE_DIRS)

up: init-cache
	docker compose up --build

up-web:
	docker compose up --force-recreate --build -d openbook-web

up-frontend: up-web

up-api: init-cache
	docker compose up --force-recreate --build -d openbook-api

up-backend: up-api
up-import: up-api
up-media: up-api

up-postgres: init-cache
	docker compose up --force-recreate --build -d postgres

down:
	docker compose down

restart:
	docker compose restart

fclean:
	rm -rf Cache
	rm -rf Api/*/target

re: down init-cache up

apk-pixel:
	cd Mobile && flutter build apk --release
	"C:/Users/Axel/AppData/Local/Android/sdk/platform-tools/adb.exe" install -r Mobile/build/app/outputs/flutter-apk/app-release.apk

.PHONY: init-cache up up-web up-frontend up-api up-backend up-import up-media up-postgres down restart fclean re apk-pixel
