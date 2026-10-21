# Service Scraper - Comics, BD & Manga

Ce microservice s'exécute dans un conteneur indépendant du backend de **Yet Another Library**.
Il surveille et scanne les catalogues et parutions de comics, mangas et bandes dessinées pour les intégrer et les mettre à jour automatiquement dans la base de données PostgreSQL du site.

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
  3. **BubbleBD** (`bubble_bd`) : Agenda complet des sorties et sélections Comics & BD franco-belges.
  4. **Morgen BD** (`morgen_bd`) : Catalogue complet des éditions Morgen BD (`https://www.morgen-bd.com/nos-albums`).
  5. **Mangetsu** (`mangetsu`) : Mangas Shonen, Seinen, Junji Ito, Tetsuo Hara (`https://mangetsu-manga.fr/catalogue/`).
  6. **Label 619** (`label619`) : Albums et créations Label 619 (`https://label619.com/` et `https://www.editions-ruedesevres.fr/label-619`).
- **Gestion stricte de l'encodage UTF-8 & Réparation Mojibake** :
  - Détection et correction automatique du double-encodage UTF-8 / Latin-1 (ex: `Ã©` -> `é`, `Ã¢` -> `â`).
  - Décodage des entités HTML (`&#x27;`, `&amp;`, `&nbsp;`).
  - Point d'entrée de maintenance : `POST /api/repair` ou `make scrape-repair`.
- **Persistance & Déduplication** :
  - Déduplication intelligente par ISBN et par titre pour éviter tout conflit de clé primaire ou unique.
  - Création automatique des éditeurs, séries, catégories et auteurs.

---

## 🛠 Configuration (Variables d'environnement)

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://strapi:strapi@project-postgres:5432/strapi` | Chaîne de connexion PostgreSQL |
| `PORT` | `5001` | Port d'écoute HTTP du microservice |
| `SCHEDULE_HOUR` | `3` | Heure du scan quotidien (0-23) |
| `SCHEDULE_MINUTE` | `0` | Minute du scan quotidien (0-59) |
| `SCRAPE_ON_STARTUP` | `true` | Lance un premier scan au démarrage du conteneur |
| `MAX_BOOKS_PER_SOURCE` | `50` | Nombre max d'albums par source en mode standard |
| `REQUEST_TIMEOUT` | `30` | Timeout HTTP en secondes pour les requêtes |

---

## 📡 API REST

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Informations du service et sources enregistrées |
| `GET` | `/api/health` | Vérification de la santé et de la connectivité DB |
| `GET` | `/api/status` | Statut en direct, job en cours et historique |
| `POST` | `/api/scrape?full={bool}` | Déclenche un scan à la demande sur toutes les sources |
| `POST` | `/api/scrape/{source}?full={bool}` | Déclenche un scan sur une source spécifique |
| `POST` | `/api/repair` | Répare et nettoie les éventuels caractères UTF-8 corrompus en base |
| `GET` | `/api/books?limit=20` | Liste des derniers albums enregistrés en base |

---

## 💻 Commandes utiles (Makefile)

```bash
# Scan rapide à la demande
make scrape-now

# Scan exhaustif de tous les catalogues
make scrape-full

# Nettoyer / réparer l'encodage des albums en base
make scrape-repair

# Voir le statut du scraper
make scraper-status
```
