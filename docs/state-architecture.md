# Architecture d'état — Pattern cible

> Document de référence. Décrit le **code réel** de la branche `fix/grok-glm`
> (commits `626d9ba` → `88f9828` : suppression du bus d'événements, des classes
> domaine `Players`/`Contacts`/`Teams`/`Matchs`/`Clubs`, de leurs variants
> `*Silent` et de l'adapter `ContactsSource`). Toute évolution de l'état doit
> suivre ce pattern.

## 1. Vue d'ensemble : le flux de données

```
[ Composants ]            lecture réactive : <For each={players}>,
                          createMemo(() => players.map(...)),
                          createMemo(() => players.length)
      │  mutations : addPlayer/updatePlayer/removePlayer,
      │  addTeam/updateTeam/removeTeam, addMatch/updateMatch/removeMatch,
      │  updateClub, addContact/updateContact/removeContact,
      │  orchestrator.registerNewPlayerWithContacts(...), ...
      ▼
[ Stores ]                src/libs/stores/*.ts — singletons module
                          createStore<XxxRawData[]>([])
                          hydrate*(raws) : recharge SANS persister
                          replaceAll*(raws) : remplacement + persist ×1
                          add/update/remove : calcul pur du next[] + persist ×1
      │  storePlayers/storeTeams/storeMatchs/storeContacts/storeClubs
      │  (persist fire-and-forget avec .catch → console.error)
      ▼
[ Orchestrator ]          src/libs/orchestrator/orchestrator.ts — hydratation
                          async au démarrage, migration club, batchs atomiques
                          register/update, import/export .bstat, doClearDB,
                          doOverwriteDB, replaceDataset, bigClean
      ▼
[ Persistance ]           localStorage : BS_PLAYERS, BS_TEAMS, BS_MATCHS,
                          BS_CONTACTS, BS_CLUBS, BS_TROMBI_TITLES
                          format { data, lastRecord } (StoredItemData<T>)
                          IndexedDB (idb-keyval) : photos « baller-stats-db »
```

Le sens unique : les composants ne touchent jamais la persistance ; la
persistance n'écrit jamais dans les stores (sauf via `hydrate*` explicite).
`src/libs/store/store.ts` fournit les clés et les wrappers ; le localStorage
est écrit de façon **synchrone** à l'intérieur d'une Promise (`storeData`),
ce qui garantit que les données migrées au démarrage sont persistées avant que
les chargeurs async ne résolvent.

## 2. Anatomie d'un store de collection

Tous les stores de collection partagent la même forme, calquée sur
`src/libs/stores/players-store.ts` :

```ts
import { createStore, reconcile } from 'solid-js/store'
import type { PlayerRawData } from '../player/player.d'
import { storePlayers } from '../store/store'

// Validation pure (aucun I/O) : lance Error si le raw n'est pas ajoutable.
export function assertPlayerAddable(existingPlayers: PlayerRawData[], newPlayer: PlayerRawData): void {
  // ... vérifie la registerabilité puis le doublon d'id
}

// Singleton de store : un seul par module, jamais recréé.
const [players, setPlayers] = createStore<PlayerRawData[]>([])

export { players } // export réactif pour <For>/createMemo

// Getters « à la frontière » : clonent chaque raw pour les lecteurs
// non-réactifs (orchestrator, tests) et empêcher toute fuite d'écriture. Mutation
// d'un objet retourné = aucun effet sur le store.
export function getRawPlayers(): PlayerRawData[] {
  return players.map((raw) => ({ ...raw }))
}

export function getPlayerById(id: string): PlayerRawData | null {
  const raw = players.find((candidate) => candidate.id === id)
  return raw ? { ...raw } : null
}

// Clone systématique à l'entrée (hydrate/replaceAll/add) : l'appelant peut
// muter son objet ensuite, le store n'est jamais touché.
function cloneRaws(raws: PlayerRawData[]): PlayerRawData[] {
  return raws.map((raw) => ({ ...raw }))
}

// Persistance fire-and-forget : jamais awaitée par l'appelant.
function persistPlayers(): void {
  storePlayers(getRawPlayers()).catch((error: unknown) => {
    console.error('storePlayers failed:', error)
  })
}

/**
 * Charge ou importe une collection complète : reconcile le contenu réactif
 * sans JAMAIS persister. La persistance reste le job explicite des mutations.
 */
export function hydratePlayers(raws: PlayerRawData[]): void {
  setPlayers(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Remplace toute la collection et persiste exactement une fois. */
export function replaceAllPlayers(raws: PlayerRawData[]): void {
  setPlayers(reconcile(cloneRaws(raws), { key: 'id' }))
  persistPlayers()
}

export function addPlayer(raw: PlayerRawData): void {
  const next = getRawPlayers()
  assertPlayerAddable(next, raw)
  setPlayers([...next, { ...raw }])
  persistPlayers()
}

export function updatePlayer(id: string, raw: PlayerRawData): void {
  const index = players.findIndex((candidate) => candidate.id === id)
  if (index === -1) { throw new Error(...) } // .add() sinon
  setPlayers(index, { ...raw })
  persistPlayers()
}

export function removePlayer(id: string): void {
  const index = players.findIndex((candidate) => candidate.id === id)
  if (index === -1) { throw new Error(...) }
  setPlayers((current) => current.filter((candidate) => candidate.id !== id))
  persistPlayers()
}
```

Les cinq collections déclinées (`players`, `contacts`, `teams`, `matchs`,
`clubs`) suivent ce squelette avec leurs variantes :

| Store | Spécificités |
|---|---|
| `players-store.ts` | `assertPlayerAddable` s'appuie sur la classe `Player` (`isRegisterable`) ; pas de test dédié, couvert par `player-batch.test.ts` |
| `contacts-store.ts` | `assertContactExists`, `getContactsByPlayerId(playerId)`, et `replacePlayerContacts(playerId, raws)` — échange atomique des contacts d'un joueur, persist ×1, sans re-validation (le batch orchestrator a déjà validé) |
| `teams-store.ts` | `assertTeamExists`, `getTeamById` |
| `matchs-store.ts` | clone **profond** (`playersInTheFive`, `stats`) : `updateMatch`, `getMatchById` ne partagent jamais de référence avec le store |
| `clubs-store.ts` | `assertClubExists`, `getClubById`, initialisé `[]` (la migration/le seed injectent un club par défaut) |

## 3. Le flux « save » du formulaire joueur

Fichiers : `src/components/players/players.tsx` + `src/components/contacts-editor/`.

**Draft local (aucune écriture store avant le submit) :**
- `currentPlayer` — signal `Player | null` (instance de la classe domaine, jamais de raw exposé).
- `pendingContacts` — `createStore<ContactRawData[]>([])` local au composant, seedé par `getContactsByPlayerId(player.id)` au début d'une édition, jamais branché sur le store global.
- `pendingPhotoBlob` / `pendingPhotoDelete` — signaux photo alimentés par `BsPhotoUpload` via `onPhotoChange`.
- `BsContactsEditor` ne reçoit que `contacts` + callbacks `onAdd`/`onUpdate`/`onRemove` (`BsContactsEditorProps`) : il manipule uniquement `pendingContacts`.

**Submit (`registerPlayer`) :**
1. Garde-fou `currentPlayer()?.isRegisterable`.
2. **Snapshot** des contacts du draft `pendingContacts.map((contact) => ({ ...contact }))` **avant** le premier `await` : le commit utilisera exactement ces raws, jamais une relecture du draft qui aurait pu dériver.
3. Appel `orchestrator.registerNewPlayerWithContacts(player, draftContacts, blob)` (création) ou `updatePlayerWithPhotoAndContacts(player, draftContacts, blob, isDelete)` (édition).
4. En cas de succès : `resetDraft()` ; en cas d'échec : toast, draft intact.

**À l'intérieur de l'orchestrator (`src/libs/orchestrator/player-batch.ts` + `orchestrator.ts`) :**
1. **Validation pure et synchrone** (aucun I/O) : `validateNewPlayerBatch` ou `validateContactReplacementBatch` — registerabilité, id unique, contacts appartenant au joueur, doublons intra-batch, addable contre la collection.
2. **I/O photo en premier** : `await applyPhoto(player, photo, deletePhotoFlag)` → `setPhotoAndFlag`/`deletePhotoAndFlag` (IndexedDB), met à jour `player.hasPhoto`.
3. **Commit en un seul `batch()`** Solid, sans `await` entre les mutations :
   - création : `addPlayer({ ...playerRaw, hasPhoto })` + `replacePlayerContacts(player.id, contactRaws)`
   - édition : `updatePlayer(player.id, { ...playerRaw, hasPhoto })` + `replacePlayerContacts(player.id, contactRaws)`
   Chaque mutation persiste une fois → **persist ×2** (players + contacts). Les stores réactifs n'exposent jamais d'état intermédiaire.

**Échec photo = rien commité :** si `applyPhoto` rejette, le `batch` n'est jamais atteint ; le joueur et ses contacts ne sont ni en mémoire ni persistés. Pas de chemin de rollback nécessaire — c'est la raison d'être de l'ordre « photo d'abord, commit en dernier ».

## 4. Règles et pièges Solid qui les motivent

1. **RawData plats uniquement dans les stores.** Un `createStore` n'accepte pas les instances avec champs privés (`#`) ni classes : Solid proxifie les objets et ne peut pas tracker des propriétés privées TS (et les classerait comme bénignes). Le store ne contient que des `XxxRawData` (interfaces nues, champs optionnels). Les classes domaine vivent à la frontière : `orchestrator.getPlayer(id)` retourne un `Player`, `players.tsx` construit `new Player(raw)` pour le draft.
2. **`reconcile(raws, { key: 'id' })` pour hydrate/replaceAll.** Le remplacement massif par `setXxx(nouveauTableau)` détruit l'identité de chaque item → Solid re-render toutes les entrées d'un `<For>` (flicker). `reconcile` diff par clé et préserve l'identité des items inchangés. Le `key: 'id'` s'appuie sur l'id stable de chaque collection.
3. **Persistance jamais en `createEffect`.** Un effet est *eager* : il s'exécute à la création ET chaque fois qu'une dépendance change, donc `persist` écrirait au chargement avec un état vide, puis sur chaque micro-mutation, et bouclerait (le persist lit le store → nouvelle version → l'effet se redéclenche). C'est pourquoi `hydrate*` ne persiste jamais et chaque mutation persiste explicitement, exactement une fois.
4. **Lectures à froid enveloppées en `createMemo`.** Dans les composants, `players` (store) est lu par `visiblePlayers = createMemo(() => players.map((raw) => new Player(raw)))` et `playerLength = createMemo(() => players.length)`: la lecture réactive est bornée au rendu, le reste du code utilise les `getRaw*` clonants.
5. **Singletons de store en test → `beforeEach(() => hydrate([]))`.** Les stores sont des singletons de module : un test qui laisserait traîner de l'état contaminerait le suivant. Le reset passe par `hydrateXxx([])` — qui par conception ne persiste pas. Les persistances sont mockées (`vi.mock('../store/store')`).
6. **Course d'hydratation async → batch multi-stores.** Le `Orchestrator` (singleton construit à l'import) lance 5 chargeurs async indépendants (dont `getStoredPlayers`/`getStoredTeams`/`getStoredClubs` qui ne réhydratent que si `stored.lastRecord > lastRecord`). Quand plusieurs collections doivent changer ensemble (import `.bstat`, demo seed, big clean), le commit passe par `replaceDataset`, `doOverwriteDB` ou `doClearDB`, qui enserrent les `replaceAll*` dans un **seul `batch()`** pour que le rendu ne voie jamais un état partiel.
7. **La migration club (`runStartupMigration`) est synchrone** (lit via `getStoredDataSync`, écrit via `storePlayers/storeTeams/storeClubs/persistTitles`) et **avance les `#lastPlayersRecord/#lastTeamsRecord/#lastClubsRecord` à `Date.now()`** : ainsi les chargeurs async qui résolvent après ne réhydratent pas avec des données plus anciennes que la migration.

## 5. Anti-patterns interdits (et pourquoi)

- **Bus d'événements** (`event-bus`, `BS::*::CHANGE`) — supprimé en `88f9828`. Les stores étant des singletons réactifs, un bus ajoute un canal de synchronisation redondant, non typé, et source de re-renders en cascade. La réactivité Solid suffit.
- **Variants `*Silent`** — supprimés. La distinction « événement + événement silencieux » n'a plus de sens : `hydrate*` ne notifie/persiste rien par conception, les mutations explicites notifient par la réactivité du store.
- **Adapters de source (`ContactsSource`)** — supprimés. Les composants lisent le store directement (`<For each={...}>`, `getRaw*`), toujours cohérent avec la persistance.
- **Classes dans les stores** — interdites (cf. règle 1). Les classes domaine restent autorisées aux frontières de lecture/validation.
- **Persistance en `createEffect`** — interdite (cf. règle 3). Persistance toujours explicite dans la mutation.

## 6. Ajouter une nouvelle collection — checklist

1. **`src/libs/stores/xxx-store.ts`** : calquer sur `teams-store.ts` (le plus simple) — `createStore<XxxRawData[]>([])`, `assertXxxAddable`, `assertXxxExists`, `getRawXxx`, `getXxxById`, `cloneRaws`, `persistXxx` (fire-and-forget `.catch(console.error)`), `hydrateXxx` (reconcile, sans persist), `replaceAllXxx` (reconcile + persist ×1), `addXxx`/`updateXxx`/`removeXxx` (validation, calcul pur du `next[]`, persist ×1). RawData plat dans `src/libs/xxx/xxx.d.ts`.
2. **`src/libs/stores/xxx-store.test.ts`** : sur le modèle de `teams-store.test.ts` — `vi.mock('../store/store')` pour mocker `storeXxx`, `beforeEach(() => { vi.clearAllMocks(); hydrateXxx([]) })`, et un test par contrat : hydrate ne persiste jamais, add/update/remove persiste exactement une fois, doublon/id inexistant lève sans persister, les getters clonent.
3. **Brancher l'orchestrateur** : hydratation au démarrage dans le constructeur (`getStoredXxx()` → `hydrateXxx(stored.data)`), `lastRecord` compare si la collection est soumise à des sur-écritures de migration ; inclusion dans `replaceDataset`/`doClearDB`/`doOverwriteDB` et l'export/import `.bstat` (`GlobalDB` dans `orchestrator.d.ts`, `isGlobalDB`).
4. **Persistance** : clé `BS_XXX` + wrappers `storeXxx`/`getStoredXxx` dans `src/libs/store/store.ts` (format `{ data, lastRecord }`).

## 7. Tests

### Patron des tests stores

`src/libs/stores/*-store.test.ts` (exemple : `contacts-store.test.ts`) :
- store = singleton → `beforeEach`: `vi.clearAllMocks()` puis `hydrateXxx([])` (reset gratuit car hydrate ne persiste pas).
- `vi.mock('../store/store', ...)` remplace `storeXxx` par un `vi.fn(() => Promise.resolve())`.
- Assertions clés : `expect(storeXxx).not.toHaveBeenCalled()` après hydrate ; `toHaveBeenCalledTimes(1)` après une mutation ; la non-mutation en entrée (mutations du raw d'hydratation, du retour de getter, de l'argument d'add/update n'affectent jamais le store).

### Le filet de caractérisation `player-batch.test.ts`

Suite de caractérisation du flux register/update joueur + contacts + photo qui
bloque le comportement observable actuel pour les évolutions futures :
- commit atomique = **un persist par collection** et état final complet dans le dernier persist ;
- la validation est **synchrone et avant tout commit** : batch invalide → rejet, zéro persist, zéro état en mémoire ;
- **photo I/O d'abord** : `setPhotoAndFlag` avant le premier persist, `hasPhoto:true` persisté ; échec photo → rejet, rien commité, flag intact ;
- `updatePlayerWithPhotoAndContacts` remplace les contacts du joueur *wholesale* sans toucher ceux des autres, et `validateContactReplacementBatch` autorise la réutilisation d'un id **du même joueur** mais rejette un id d'un **autre** joueur ;
- `replacePlayerContacts` = swap ciblé, persist ×1 ;
- `hydrate` ne persiste jamais.