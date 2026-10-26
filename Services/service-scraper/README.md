# Service Scraper (Go) - Comics, BD & Manga

Ce microservice en **Go** s'exécute dans un conteneur indépendant du backend de **Yet Another Library**.
Il surveille et scanne les catalogues et parutions de comics, mangas et bandes dessinées pour les intégrer, les enrichir (via le catalogue BnF SRU) et les mettre à jour automatiquement dans la base de données PostgreSQL du site.

---

## 🚀 Fonctionnalités

- **Exécution quotidienne programmée (1x par jour)** : Scan automatique chaque jour à l'heure configurée (`SCHEDULE_HOUR:SCHEDULE_MINUTE`, par défaut 03h00).
- **Exécution à la demande** :
  - **Interface Web** : Panneau de contrôle interactif avec déclenchement rapide ou complet et filtres par éditeur dans `/app/planning`.
  - **API REST** : Déclenchement instantané via `POST /api/scrape` ou `POST /api/scrape/{source}` avec support du paramètre `?full=true`.
  - **CLI Docker / Makefile** : `make scrape-now` (scan rapide) ou `make scrape-full` (crawl exhaustif).
- **Sources intégrées** :
  1. **Urban Comics** (`urban_comics`) : Nouveautés et catalogue de comics DC, Vertigo, Indies.
  2. **Panini Comics** (`panini`) : Parutions Marvel, Star Wars et collections Panini.
  3. **Morgen BD** (`morgen_bd`) : Catalogue complet des éditions Morgen BD (`https://www.morgen-bd.com/nos-albums`).
  4. **Mangetsu** (`mangetsu`) : Mangas Shonen, Seinen, Junji Ito, Tetsuo Hara (`https://mangetsu-manga.fr/catalogue/`).
  5. **Label 619** (`label619`) : Albums et créations Label 619 (`https://www.label619.com/fr/editions`).
  6. **Monsieur Toussaint Louverture** (`monsieur_toussaint_louverture`) : Romans graphiques, BD et collections littéraires (`https://monsieurtoussaintlouverture.com`).
- **Enrichissement & Vérification BnF (SRU Unimarc/Dublin Core)** :
  - Enrichissement des métadonnées manquantes (ISBN, auteurs, pagination, collection) via `POST /api/maintenance/enrich-bnf`.
  - Vérification et correction des métadonnées par ISBN via `POST /api/maintenance/verify-bnf`.
- **Gestion stricte de l'encodage UTF-8 & Réparation Mojibake** :
  - Détection et correction automatique du double-encodage UTF-8 / Latin-1 (ex: `Ã©` -> `é`, `Ã¢` -> `â`).
  - Décodage des entités HTML (`&#x27;`, `&amp;`, `&nbsp;`).
  - Point d'entrée de maintenance : `POST /api/repair` ou `make scrape-repair`.
- **Persistance & Déduplication** :
  - Déduplication intelligente par ISBN et par titre pour éviter tout conflit de clé primaire ou unique.
  - Détection et liaison automatique des couvertures variantes / collector.
  - Création automatique des éditeurs, séries, collections, catégories et auteurs.

---

## 🛠 Configuration (Variables d'environnement)

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://strapi:strapi@project-postgres:5432/strapi?sslmode=disable` | Chaîne de connexion PostgreSQL |
| `MEDIA_SERVICE_URL` | `http://project-media:5002` | URL du microservice `service-media` |
| `PORT` | `5001` | Port d'écoute HTTP du microservice |
| `SCHEDULE_HOUR` | `3` | Heure du scan quotidien (0-23) |
| `SCHEDULE_MINUTE` | `0` | Minute du scan quotidien (0-59) |
| `SCRAPE_ON_STARTUP` | `true` | Lance un premier scan au démarrage du conteneur |
| `MAX_BOOKS_PER_SOURCE` | `50` | Nombre max d'albums par source en mode standard |
| `REQUEST_TIMEOUT` | `30` | Timeout HTTP en secondes pour les requêtes |

---

## 💻 Commandes utiles

```bash
# Compiler le binaire localement
go build -o scraper-service .

# Exécuter les tests unitaires
go test -v ./...

# Scan rapide à la demande (Docker)
make scrape-now

# Scan exhaustif de tous les catalogues (Docker)
make scrape-full

# Nettoyer / réparer l'encodage des albums en base (Docker)
make scrape-repair

# Voir le statut du scraper
make scraper-status
```
