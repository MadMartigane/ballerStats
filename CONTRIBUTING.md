# Contribuer à BallerStats

Ce document explique comment travailler sur l'application : prérequis, démarrage, backend local,
vérifications avant commit et conventions de commit. Les règles d'architecture et de style de code
vivent dans [`AGENTS.md`](AGENTS.md) (en anglais) et [`docs/state-architecture.md`](docs/state-architecture.md).

## Prérequis

- **Node.js 20 ou plus récent** — le helper de démarrage refuse les versions antérieures.
- **pnpm** — c'est le seul gestionnaire de paquets supporté (pas de `npm`, pas de `yarn`).
  Installation : `corepack enable pnpm` ou <https://pnpm.io/installation>.
- Un terminal interactif pour les menus (aucun menu n'est affiché quand l'entrée standard n'est pas un TTY).

`pnpm install` n'est pas à lancer à la main : `pnpm run dev` s'en charge quand `node_modules`
est absent ou vide.

## Démarrage rapide

```bash
git clone <url-du-depot> ballerStats
cd ballerStats
pnpm run dev
```

`pnpm run dev` exécute `scripts/dev.mjs` (Node ESM, sans dépendance) puis Vite. Le script :

1. vérifie les prérequis (version de Node, `pnpm` disponible) ;
2. installe les dépendances avec `pnpm install` si `node_modules` est absent ou vide ;
3. crée `.env` à partir de `.env.example` s'il manque, puis s'assure que `VITE_NOSTROMO_URL` est
   définie — menu si la valeur est absente ou vide, valeur existante jamais écrasée ;
4. interroge `GET <VITE_NOSTROMO_URL>/api/health` (timeout court) et propose un menu si le backend
   est injoignable : démarrer le backend nostromo, le démarrer puis amorcer les comptes de dev,
   continuer sans backend, ou quitter ;
5. démarre Vite sur <http://localhost:3000> (`pnpm exec vite`, stdio hérité).

`Ctrl+C` arrête Vite et le script transmet le signal au processus enfant. Un backend démarré par
le menu reste actif après l'arrêt de Vite.

Échappatoire : `pnpm run dev:vite` lance Vite seul, sans aucune préparation.

### Mode non interactif

En CI ou derrière un pipe (`stdin` n'est pas un TTY), le script ne pose jamais de question : il
applique les choix par défaut, journalise ce qu'il fait, ne démarre aucun service et continue vers Vite.

## Configuration de l'environnement

- `.env` vit à la racine du dépôt et n'est **pas versionné** (il est listé dans `.gitignore`).
  `.env.example` est le modèle versionné — ne jamais y mettre de secret.
- `VITE_NOSTROMO_URL` : URL du backend Nostromo (`http://localhost:8090` par défaut). Vite lit `.env`
  automatiquement et l'application lit `import.meta.env.VITE_NOSTROMO_URL`.
- Si la variable est absente ou vide, l'application démarre **en mode local seul** : les données
  restent locales, sans synchronisation. Le menu réapparaît au prochain `pnpm run dev`.
- Pour changer de backend, modifiez la ligne `VITE_NOSTROMO_URL` dans `.env` (ou supprimez `.env`
  pour repartir de `.env.example`).

## Backend Nostromo local

Le backend vit dans un dépôt frère, `~/workspace/nostromo`, sous `infra/pocketbase/` (PocketBase).
Le helper n'y touche que via ses scripts, jamais en modifiant le dépôt.

| Élément | Rôle |
|---|---|
| `infra/pocketbase/scripts/serve.sh` | Démarre PocketBase sur `http://127.0.0.1:8090` (origines CORS dev : `http://localhost:3000`). Option `[1]` du menu. |
| `infra/pocketbase/scripts/bootstrap.sh` | Crée/actualise le superuser dev **et** le premier utilisateur applicatif (idempotent). Option `[2]` du menu, après le health check. |
| `infra/pocketbase/scripts/download.sh` | Télécharge le binaire PocketBase épinglé ; appelé par `serve.sh`. |
| `GET http://127.0.0.1:8090/api/health` | Sonde utilisée par le helper (200 = backend prêt, attente jusqu'à 30 s). |

Comptes de développement (DEV UNIQUEMENT, jamais réutilisés ailleurs) :

- superuser : `dev@nostromo.local` ; mot de passe et identifiants affichés par `bootstrap.sh` ;
- premier utilisateur applicatif : `app@nostromo.local`, mot de passe généré affiché une seule fois ;
- interface d'administration : <http://127.0.0.1:8090/_/>.

Sans backend local, rien ne casse : l'application démarre en mode local seul. Pour démarrer le
backend à la main (par exemple pour lire ses logs) :

```bash
bash ~/workspace/nostromo/infra/pocketbase/scripts/serve.sh        # terminal 1
bash ~/workspace/nostromo/infra/pocketbase/scripts/bootstrap.sh    # terminal 2, après le health check
```

## Scripts disponibles

| Script | Effet |
|---|---|
| `pnpm run dev` | **Démarrage normal** : préparation complète (dépendances, `.env`, backend) puis Vite. |
| `pnpm run dev:vite` | Vite seul, sans préparation (dépannage). |
| `pnpm run build` | Build de production dans `dist/`. |
| `pnpm run serve` | Prévisualise le build de production (`vite preview`). |
| `pnpm run start` | Alias de Vite (sans préparation). |
| `pnpm run check` | Lint + format Biome/Ultracite en mode vérification. |
| `pnpm run fix` | Corrige lint + format (remplace `format`). |
| `pnpm run format` | Alias de `fix`. |
| `pnpm run format-force` | Corrige aussi les corrections « unsafe ». |
| `pnpm run test` | Tests Vitest (une passe). |
| `pnpm run test:watch` | Tests en mode watch. |
| `pnpm run test:coverage` | Tests avec rapport de couverture. |
| `pnpm run typecheck` | Vérification TypeScript (`tsc --noEmit`). |
| `pnpm run prepare` | Installe les hooks husky (lancé par `pnpm install`). |
| `pnpm run pre-prod` / `prod` | Build + copie vers `/var/www/...` (Linux uniquement, déploiement). |
| `pnpm run pre-prod-only` / `prod-only` | Copie seule, sans rebuild. |
| `pnpm run pre-prod-clean` / `prod-clean` | Vide le dossier de destination. |
| `pnpm run pre-prod-push` / `prod-push` | Copie `dist/` vers la destination. |

## Vérifications avant commit

```bash
pnpm run check       # Biome/Ultracite : lint + format
pnpm run typecheck   # TypeScript
pnpm run test        # Vitest (suite complète)
```

Le hook husky de pré-commit (`.husky/`) exécute déjà `pnpm run check` puis `pnpm run typecheck` :
un commit qui échoue à l'un des deux est refusé. Les tests ne sont pas lancés par le hook, à vous de
les exécuter avant de pousser.

## Conventions de commit

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/) et sont écrits en
anglais, à l'impératif :

```
feat(players): add bulk import from CSV
fix(stores): persist once after batch update
docs: document the one-command dev setup
chore(ambient): claim task 12
```

Types utilisés : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
Un commit = un changement logique, avec les suppressions associées (routes, pages, fichiers, exports
devenus morts) dans le même commit.

## Structure du projet

```
docs/          Références d'architecture (state-architecture.md)
scripts/       Outillage de développement (dev.mjs)
src/
├── components/  Composants UI réutilisables (préfixe Bs*)
├── global/      État global, thème, polices
├── libs/        Logique métier, utilitaires, stores
│   └── stores/  Stores de collection (createStore singletons)
├── pages/       Composants de route
└── index.tsx    Point d'entrée de l'application
```

Règles d'architecture détaillées, conventions de style et contraintes d'état : [`AGENTS.md`](AGENTS.md)
et [`docs/state-architecture.md`](docs/state-architecture.md).
