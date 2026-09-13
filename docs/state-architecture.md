# State Architecture — Target Pattern

> Reference document. Describes the **real code** of the `fix/grok-glm` branch
> (commits `626d9ba` → `88f9828`: removal of the event bus, of the domain
> classes `Players`/`Contacts`/`Teams`/`Matchs`/`Clubs`, of their `*Silent`
> variants and of the `ContactsSource` adapter). Any evolution of the state
> must follow this pattern.

## 1. Overview: the data flow

```
[ Components ]            reactive reads: <For each={players}>,
                          createMemo(() => players.map(...)),
                          createMemo(() => players.length)
      │  mutations: addPlayer/updatePlayer/removePlayer,
      │  addTeam/updateTeam/removeTeam, addMatch/updateMatch/removeMatch,
      │  updateClub, addContact/updateContact/removeContact,
      │  orchestrator.registerNewPlayerWithContacts(...), ...
      ▼
[ Stores ]                src/libs/stores/*.ts — module singletons
                          createStore<XxxRawData[]>([])
                          hydrate*(raws): reload WITHOUT persisting
                          replaceAll*(raws): replace + persist ×1
                          add/update/remove: pure next[] computation + persist ×1
      │  storePlayers/storeTeams/storeMatchs/storeContacts/storeClubs
      │  (fire-and-forget persist with .catch → console.error)
      ▼
[ Orchestrator ]          src/libs/orchestrator/orchestrator.ts — async startup
                          hydration, club migration, atomic register/update
                          batches, import/export .bstat, doClearDB,
                          doOverwriteDB, replaceDataset, bigClean
      ▼
[ Persistence ]           localStorage: BS_PLAYERS, BS_TEAMS, BS_MATCHS,
                          BS_CONTACTS, BS_CLUBS, BS_TROMBI_TITLES
                          { data, lastRecord } format (StoredItemData<T>)
                          IndexedDB (idb-keyval): "baller-stats-db" photos
```

One-way flow: components never touch persistence; persistence never writes
into the stores (except via explicit `hydrate*`). `src/libs/store/store.ts`
provides the keys and wrappers; localStorage is written **synchronously**
inside a Promise (`storeData`), which guarantees that data migrated at startup
is persisted before the async loaders resolve.

## 2. Anatomy of a collection store

All collection stores share the same shape, modeled on
`src/libs/stores/players-store.ts`:

```ts
import { createStore, reconcile } from 'solid-js/store'
import type { PlayerRawData } from '../player/player.d'
import { storePlayers } from '../store/store'

// Pure validation (no I/O): throws an Error if the raw is not addable.
export function assertPlayerAddable(existingPlayers: PlayerRawData[], newPlayer: PlayerRawData): void {
  // ... checks registerability, then the id duplicate
}

// Store singleton: one per module, never recreated.
const [players, setPlayers] = createStore<PlayerRawData[]>([])

export { players } // reactive export for <For>/createMemo

// "Boundary" getters: clone each raw for non-reactive readers
// (orchestrator, tests) to prevent any write leak. Mutating
// a returned object has no effect on the store.
export function getRawPlayers(): PlayerRawData[] {
  return players.map((raw) => ({ ...raw }))
}

export function getPlayerById(id: string): PlayerRawData | null {
  const raw = players.find((candidate) => candidate.id === id)
  return raw ? { ...raw } : null
}

// Systematic clone on entry (hydrate/replaceAll/add): the caller can
// mutate its object afterwards; the store is never touched.
function cloneRaws(raws: PlayerRawData[]): PlayerRawData[] {
  return raws.map((raw) => ({ ...raw }))
}

// Fire-and-forget persistence: never awaited by the caller.
function persistPlayers(): void {
  storePlayers(getRawPlayers()).catch((error: unknown) => {
    console.error('storePlayers failed:', error)
  })
}

/**
 * Loads or imports a complete collection: reconciles the reactive content
 * without EVER persisting. Persistence remains the explicit job of mutations.
 */
export function hydratePlayers(raws: PlayerRawData[]): void {
  setPlayers(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replaces the whole collection and persists exactly once. */
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
  if (index === -1) { throw new Error(...) } // .add() otherwise
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

The five derived collections (`players`, `contacts`, `teams`, `matchs`,
`clubs`) follow this skeleton with their variants:

| Store | Specifics |
|---|---|
| `players-store.ts` | `assertPlayerAddable` relies on the `Player` class (`isRegisterable`); no dedicated test, covered by `player-batch.test.ts` |
| `contacts-store.ts` | `assertContactExists`, `getContactsByPlayerId(playerId)`, and `replacePlayerContacts(playerId, raws)` — atomic exchange of a player's contacts, persist ×1, without re-validation (the orchestrator batch has already validated) |
| `teams-store.ts` | `assertTeamExists`, `getTeamById` |
| `matchs-store.ts` | **deep** clone (`playersInTheFive`, `stats`): `updateMatch`, `getMatchById` never share a reference with the store |
| `clubs-store.ts` | `assertClubExists`, `getClubById`, initialized `[]` (migration/seed injects a default club) |

## 3. The player form "save" flow

Files: `src/components/players/players.tsx` + `src/components/contacts-editor/`.

**Local draft (no store writes before the submit):**
- `currentPlayer` — `Player | null` signal (domain class instance, never an exposed raw).
- `pendingContacts` — `createStore<ContactRawData[]>([])` local to the component, seeded by `getContactsByPlayerId(player.id)` at the start of an edit, never wired to the global store.
- `pendingPhotoBlob` / `pendingPhotoDelete` — photo signals fed by `BsPhotoUpload` via `onPhotoChange`.
- `BsContactsEditor` only receives `contacts` + `onAdd`/`onUpdate`/`onRemove` callbacks (`BsContactsEditorProps`): it only manipulates `pendingContacts`.

**Submit (`registerPlayer`):**
1. Guard `currentPlayer()?.isRegisterable`.
2. **Snapshot** of the draft contacts `pendingContacts.map((contact) => ({ ...contact }))` **before** the first `await`: the commit will use exactly these raws, never a re-read of the draft that could have drifted.
3. Call `orchestrator.registerNewPlayerWithContacts(player, draftContacts, blob)` (creation) or `updatePlayerWithPhotoAndContacts(player, draftContacts, blob, isDelete)` (edition).
4. On success: `resetDraft()`; on failure: toast, draft intact.

**Inside the orchestrator (`src/libs/orchestrator/player-batch.ts` + `orchestrator.ts`):**
1. **Pure synchronous validation** (no I/O): `validateNewPlayerBatch` or `validateContactReplacementBatch` — registerability, unique id, contacts belonging to the player, intra-batch duplicates, addable against the collection.
2. **Photo I/O first**: `await applyPhoto(player, photo, deletePhotoFlag)` → `setPhotoAndFlag`/`deletePhotoAndFlag` (IndexedDB), updates `player.hasPhoto`.
3. **Commit in a single Solid `batch()`, with no `await` between the mutations:**
   - creation: `addPlayer({ ...playerRaw, hasPhoto })` + `replacePlayerContacts(player.id, contactRaws)`
   - edition: `updatePlayer(player.id, { ...playerRaw, hasPhoto })` + `replacePlayerContacts(player.id, contactRaws)`
   Each mutation persists once → **persist ×2** (players + contacts). Reactive stores never expose an intermediate state.

**Photo failure = nothing committed:** if `applyPhoto` rejects, the `batch` is never reached; the player and their contacts are neither in memory nor persisted. No rollback path is needed — that is the entire point of the "photo first, commit last" ordering.

## 4. Rules and the Solid pitfalls that motivate them

1. **Flat RawData only in stores.** A `createStore` does not accept instances with private fields (`#`) or classes: Solid proxifies objects and cannot track TS private properties (and would classify them as benign). The store only holds `XxxRawData` (bare interfaces, optional fields). Domain classes live at the boundary: `orchestrator.getPlayer(id)` returns a `Player`, `players.tsx` builds `new Player(raw)` for the draft.
2. **`reconcile(raws, { key: 'id' })` for hydrate/replaceAll.** Bulk replacement via `setXxx(newArray)` destroys each item's identity → Solid re-renders every entry of a `<For>` (flicker). `reconcile` diffs by key and preserves the identity of unchanged items. The `key: 'id'` relies on each collection's stable id.
3. **Never persist in a `createEffect`.** An effect is *eager*: it runs at creation AND every time a dependency changes, so `persist` would write an empty state at load, then on every micro-mutation, and would loop (persist reads the store → new version → the effect re-triggers). That is why `hydrate*` never persists and each mutation persists explicitly, exactly once.
4. **Cold reads wrapped in `createMemo`.** In components, `players` (store) is read via `visiblePlayers = createMemo(() => players.map((raw) => new Player(raw)))` and `playerLength = createMemo(() => players.length)`: reactive reads are bounded to rendering, the rest of the code uses the cloning `getRaw*` getters.
5. **Store singletons in tests → `beforeEach(() => hydrate([]))`.** Stores are module singletons: a test that leaves state behind would contaminate the next one. The reset goes through `hydrateXxx([])` — which by design does not persist. Persistences are mocked (`vi.mock('../store/store')`).
6. **Async hydration race → multi-store batch.** The `Orchestrator` (singleton built at import) starts 5 independent async loaders (including `getStoredPlayers`/`getStoredTeams`/`getStoredClubs` which only rehydrate if `stored.lastRecord > lastRecord`). When several collections must change together (`.bstat` import, demo seed, big clean), the commit goes through `replaceDataset`, `doOverwriteDB` or `doClearDB`, which wrap the `replaceAll*` calls in a **single `batch()`** so rendering never sees a partial state.
7. **The club migration (`runStartupMigration`) is synchronous** (reads via `getStoredDataSync`, writes via `storePlayers/storeTeams/storeClubs/persistTitles`) and **advances `#lastPlayersRecord/#lastTeamsRecord/#lastClubsRecord` to `Date.now()`**: so the async loaders that resolve afterwards never rehydrate with data older than the migration.

## 5. Forbidden anti-patterns (and why)

- **Event bus** (`event-bus`, `BS::*::CHANGE`) — removed in `88f9828`. Since stores are reactive singletons, a bus adds a redundant, untyped synchronization channel and a source of cascading re-renders. Solid's reactivity is enough.
- **`*Silent` variants** — removed. The "event + silent event" distinction no longer makes sense: `hydrate*` notifies/persists nothing by design, explicit mutations notify through store reactivity.
- **Source adapters (`ContactsSource`)** — removed. Components read the store directly (`<For each={...}>`, `getRaw*`), always consistent with persistence.
- **Classes in stores** — forbidden (see rule 1). Domain classes remain allowed at the read/validation boundaries.
- **Persistence in `createEffect`** — forbidden (see rule 3). Persistence is always explicit in the mutation.

## 6. Adding a new collection — checklist

1. **`src/libs/stores/xxx-store.ts`**: model it on `teams-store.ts` (the simplest) — `createStore<XxxRawData[]>([])`, `assertXxxAddable`, `assertXxxExists`, `getRawXxx`, `getXxxById`, `cloneRaws`, `persistXxx` (fire-and-forget `.catch(console.error)`), `hydrateXxx` (reconcile, no persist), `replaceAllXxx` (reconcile + persist ×1), `addXxx`/`updateXxx`/`removeXxx` (validation, pure `next[]` computation, persist ×1). Flat RawData in `src/libs/xxx/xxx.d.ts`.
2. **`src/libs/stores/xxx-store.test.ts`**: modeled on `teams-store.test.ts` — `vi.mock('../store/store')` to mock `storeXxx`, `beforeEach(() => { vi.clearAllMocks(); hydrateXxx([]) })`, and one test per contract: hydrate never persists, add/update/remove persists exactly once, duplicate/missing id throws without persisting, getters clone.
3. **Wire the orchestrator**: startup hydration in the constructor (`getStoredXxx()` → `hydrateXxx(stored.data)`), `lastRecord` comparison if the collection is subject to migration overwrites; inclusion in `replaceDataset`/`doClearDB`/`doOverwriteDB` and the `.bstat` export/import (`GlobalDB` in `orchestrator.d.ts`, `isGlobalDB`).
4. **Persistence**: `BS_XXX` key + `storeXxx`/`getStoredXxx` wrappers in `src/libs/store/store.ts` (`{ data, lastRecord }` format).

## 7. Tests

### Store test pattern

`src/libs/stores/*-store.test.ts` (example: `contacts-store.test.ts`):
- store = singleton → `beforeEach`: `vi.clearAllMocks()` then `hydrateXxx([])` (free reset since hydrate does not persist).
- `vi.mock('../store/store', ...)` replaces `storeXxx` with a `vi.fn(() => Promise.resolve())`.
- Key assertions: `expect(storeXxx).not.toHaveBeenCalled()` after hydrate; `toHaveBeenCalledTimes(1)` after a mutation; input non-mutation (mutating the hydrate raw, the getter return, the add/update argument never affects the store).

### The `player-batch.test.ts` characterization net

Characterization suite of the player + contacts + photo register/update flow that
locks down the current observable behavior for future evolutions:
- atomic commit = **one persist per collection** and complete final state in the last persist;
- validation is **synchronous and before any commit**: invalid batch → rejection, zero persists, zero in-memory state;
- **photo I/O first**: `setPhotoAndFlag` before the first persist, `hasPhoto:true` persisted; photo failure → rejection, nothing committed, flag intact;
- `updatePlayerWithPhotoAndContacts` replaces the player's contacts *wholesale* without touching those of other players, and `validateContactReplacementBatch` allows reusing an id **from the same player** but rejects an id from a **different** player;
- `replacePlayerContacts` = targeted swap, persist ×1;
- `hydrate` never persists.