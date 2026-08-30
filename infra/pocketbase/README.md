# PocketBase local (BallerStats)

Backend de dev local : **PocketBase v0.40.0**, migrations versionnées,
hooks JS, bootstrap idempotent d'un club de démonstration.

> ⚠️ Tout ce dossier est **DEV local uniquement**. Les identifiants ci-dessous
> sont des credentials de développement. Ne jamais déployer ce binaire, ces
> données (`pb_data/`) ou le bootstrap en production.

## Démarrage rapide

```bash
pnpm run pb:serve        # télécharge le binaire si absent, puis sert sur http://127.0.0.1:8090
pnpm run pb:bootstrap    # (serve déjà lancé) crée superuser + club de démo + owner
```

- Admin UI : http://127.0.0.1:8090/_/
- API : http://127.0.0.1:8090/api/... (docs: http://127.0.0.1:8090/api/docs)

### Identifiants de bootstrap (DEV uniquement)

| Rôle      | Email              | Mot de passe  |
|-----------|--------------------|---------------|
| Superuser | `dev@baller.local` | `DevDevDev1!` |
| Owner     | `owner@baller.local` | `DevDevDev1!` |

Club créé : **Dev Club** (`owner@baller.local` est membre avec rôle `owner`).
Le SPA devra utiliser `VITE_POCKETBASE_URL=http://127.0.0.1:8090`.

Le bootstrap ne crée jamais ces comptes en production : il n'existe qu'en script
(`scripts/bootstrap.sh`), pas dans les migrations. Le superuser est inscrit
directement dans la base locale via `pocketbase superuser upsert`.

## Scripts

| Script | Description |
|---|---|
| `scripts/download.sh` | Télécharge `pocketbase_0.40.0_<os>_<arch>.zip` depuis GitHub si absent (détection linux/darwin × amd64/arm64). |
| `scripts/serve.sh` | `pocketbase serve --http=127.0.0.1:8090 --dir pb_data --migrationsDir pb_migrations --hooksDir pb_hooks --automigrate=0 --origins=http://127.0.0.1:3000 --origins=http://localhost:3000` |
| `scripts/bootstrap.sh` | Idempotent : superuser, user owner, club « Dev Club », `club_members` rôle `owner`. |

CORS autorisés : `http://127.0.0.1:3000` et `http://localhost:3000`
(dev server Vite). `--automigrate=0` : les modifications faites dans l'Admin UI
ne génèrent pas de fichiers de migration intempestifs.

## Fichiers

```
infra/pocketbase/
├── pb_migrations/     # migrations JS versionnées (appliquées au démarrage)
│   ├── 001_users.js        # collection users (signup public désactivé, self view)
│   ├── 002_collections.js  # clubs, club_members, teams, team_members,
│   │                       # team_players, players, contacts, matchs
│   ├── 003_rules.js        # API rules (voir « Modèle d'accès »)
│   └── 004_settings.js     # appName « BallerStats »
├── pb_hooks/          # hooks JS (.pb.js)
│   ├── common.pb.js           # helpers partagés (membership)
│   ├── invite.pb.js           # POST /api/baller/invite + POST /api/baller/users/enrich
│   ├── matchs_lock.pb.js      # lease de scoring + POST /api/baller/matchs/{id}/acquire
│   └── players_attach.pb.js   # gate création players/contacts par staff
└── scripts/           # download / serve / bootstrap
```

Le binaire `pocketbase`, `pb_data/` et les archives `.zip` sont ignorés par git.

## Collections & modèle d'accès

Toutes les règles sont dans `003_rules.js`. Règles écrites pour PocketBase
0.40 : les back-relations (`X_via_field`) étant traitées comme multi, elles
utilisent les opérateurs `?=` (any-of) ; l'unicité `(club, user)` /
`(team, user)` / `(team, player)` est garantie par index UNIQUE.

- **users** (auth) : connexion email/password, `createRule = null` (pas de
  signup public), `viewRule = "id = @request.auth.id"` (chaque user ne voit
  que lui-même). Provisioning par hook d'invite, superuser ou bootstrap.
- **clubs** : list/view si membre du club (`club_members_via_club.user ?= @request.auth.id`),
  create si authentifié, update/delete owner ou admin.
- **club_members** : roles `owner|admin|staff` ; list si membre du club ;
  create/update/delete owner ou admin (rôle `owner` non assignable sauf par
  le owner de ce club) ; index UNIQUE `(club, user)`.
- **teams** : owner/admin CRUD complet ; staff ne voit/modifie que les équipes
  où il a une ligne `team_members`.
- **team_members** : champ `access` `read|write` ; owner/admin CRUD, staff ne
  liste que ses propres lignes ; UNIQUE `(team, user)`.
- **team_players** : jonction (permet d'écrire l'ACL « équipe qui contient le
  joueur » en règles API) ; visibilité calquée sur l'équipe ; UNIQUE `(team, player)`.
- **players** : list/view owner/admin du club OU staff ayant un `team_members`
  sur une équipe qui contient le joueur (`team_players`) ; write idem avec
  `access = "write"`. À la création par staff, le hook exige `teamIds`
  (équipes writables) et crée les `team_players` à sa place.
- **contacts** : mêmes règles que le joueur associé (via `player`). Un staff
  qui crée un contact doit avoir un accès write sur une équipe contenant le joueur.
- **matchs** : list/view si visibilité équipe ; create/update/delete si write
  sur l'équipe (ou owner/admin) ; `status` `unlocked|locked` ; hook de lease
  de scoring sur `stats` / `playersInTheFive` (voir hooks).

## Hooks

### Invite — `POST /api/baller/invite`

Caller : auth obligatoire, owner/manager (v1 : un seul club par user, résolu
depuis ses `club_members`).

```json
{ "email": "coach@example.com", "name": "Coach", "role": "staff", "teamId": "TEAM_ID", "access": "write" }
```

- `role` : `staff` (défaut) ou `admin` — jamais `owner`.
- Crée le user (mot de passe aléatoire ≥ 10 car. via `$security.randomString(12)`),
  la ligne `club_members`, et éventuellement la ligne `team_members`.
- Réponse : `{ "email", "password", "userId" }`. Pas de SMTP.
- Idempotent : si l'email existe déjà, les membreships sont ajoutés et
  `password` vaut `null` (le mot de passe d'origine n'est pas récupérable).

### `POST /api/baller/users/enrich`

`{ "ids": [...] }` → `{ "users": [{ id, name, email }] }`. Résout les noms de
membres sans ouvrir la collection users (limité au club du caller).

### Lease de scoring — `matchs`

- `onRecordUpdateRequest('matchs')` : toute modification de `stats` ou
  `playersInTheFive` est refusée (403) sauf si
  - le caller est le `scorer` courant **et** `scorerLockUntil` est dans le
    futur, ou
  - le caller est owner/admin du club du match, ou
  - le caller est un superuser (dashboard).
  Les changements de `status` / autres champs passent pour les membres avec
  write (`team_members.access = write`), la comparaison se fait sur l'ancien
  et le nouveau record (`record.original()`).
- `POST /api/baller/matchs/{id}/acquire` : attribue `scorer = auth` et
  `scorerLockUntil = now + 45s` si le lease est libre, expiré, détenu par le
  même user ; `{ "force": true }` ne passe que pour owner/admin.
  Réponse : `{ scorer, scorerLockUntil, expiresInSeconds }`.

### Création players/contacts par staff — `players_attach.pb.js`

Un staff (rôle `staff`) ne peut créer un joueur que s'il envoie `teamIds`
(équipes du club où il a `access = "write"`) ; le hook crée les lignes
`team_players`. Un contact créé par staff exige un accès write sur une équipe
contenant déjà le joueur. Owner/admin et superuser passent librement.

## Trous / limites assumées (v1)

- `clubs.createRule` ne limite pas le nombre de clubs par user (« premier
  club » non compté). Le mult-club n'est pas modélisé : invite et enrich
  résolvent « le club » via la première membership du caller.
- Un user peut créer un club seul, sans « re-join » contrôlé (pas de gestion
  des demandes d'adhésion).
- `team_members` : des changements purs de rôle/access passent si le caller
  est owner/admin du club (pas de re-vérification « équipe du même club » à
  l'update — limité au comportement attendu).
- Les joueurs ont une seule `club` ; les stats de match sont gérées via le
  lease (pas de verrou au niveau base).
- Les règles API ne couvrent pas les changements transverses multi-enregistrements
  (ex. déplacer un membership vers un autre club) : c'est le rôle du hook/du client.
- `users.viewRule` = self : l'Admin UI reste la source de vérité pour la
  gestion admin ; le SPA passe par `/api/baller/users/enrich` pour les noms.
- Pas de SMTP : les mots de passe d'invite sont renvoyés une seule fois à
  l'appelant.