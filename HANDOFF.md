# HANDOFF — Dossier de findings Nostromo sync (branche `feat/pocketbase`, HEAD `246f794`)

## Objet de ce document

Ce dossier rassemble les constats volontairement mis de côté après le cycle revue/contre-revue/smoke test de la synchronisation Nostromo. Il est écrit pour la session qui va **concevoir les solutions** : chaque finding décrit le symptôme, les conditions de reproduction, les preuves vérifiées contre le code à HEAD, l'impact et le périmètre, puis liste les questions ouvertes. Ce document ne propose **aucune solution, aucun design, aucune intention d'implémentation** ; là où un commentaire de code ou un message de commit enregistre déjà un choix délibéré, il est cité comme preuve, pas comme recommandation. `TODO.md` (commit `246f794`) couvre les mêmes sujets en version courte : chaque finding ici est auto-suffisant.

| N | Titre | Sévérité | Statut |
|---|-------|----------|--------|
| 1 | Écrasement serveur silencieux (wipe/import/seed propagés au serveur) | Majeur | Décision produit requise |
| 2 | Statut `unconfigured` mort dans l'union `NostromoStatus` | Mineur | Ouvert |
| 3 | Baseline photo écrite avec la version lue au moment du plan | Moyen | Ouvert |
| 4 | `markCollectionDirty` après `await` dans le store des titres | Moyen | Ouvert |
| 5 | Reliquats de documents distants (photos et collections) | Moyen | Risque assumé / à trancher |
| 6 | Divers P3 de revue | Mineur | Ouvert |
| 7 | Findings de vérification qui restent ouverts | Moyen (variable) | Ouvert |

---

## Contexte

### La fonctionnalité

Sauvegarde automatique vers un backend Nostromo (cœur PocketBase) : chaque mutation de store marque son unité dirty, un push debounced (10 s) envoie un document par collection plus un document par photo (granularité B). Le push tolère les pannes (une unité en échec reste en file), parque les conflits 409 dans la baseline, et la restauration est bi-directionnelle derrière un plan confirmé (« Restaurer le serveur » / « Écraser le serveur » / « Annuler »). L'export/import manuel `.bstat` (`orchestrator.exportDB` / `importDB`) reste intact et indépendant.

### Où vit le code

`src/libs/nostromo/` :

- `client.ts` — client HTTP typé (health, auth, documents CRUD, upload/download de fichiers, `NostromoClientError`, `photoDocId`).
- `env.ts` — lecture build-time de `VITE_NOSTROMO_URL`, unique point de conversion env → runtime.
- `nostromo-config-store.ts` — config (baseUrl, email, token, userId) persistée en localStorage, `isConfigured`.
- `nostromo-sync-store.ts` — status, log borné (50), baselines (`BS_NOSTROMO_BASELINES`), outbox (`BS_NOSTROMO_OUTBOX`), révisions de marks.
- `dirty-marks.ts` — marques unitaires + debounce glissant (`DIRTY_DEBOUNCE_MS = 10_000`), feuille importée par les stores.
- `push-engine.ts` — flush (`flushNostromoPush`), ordre de push, adopt/create/update, suppression distante des photos, parking de conflits, retries (60 s + onglet caché).
- `units.ts` — modèle des unités : quel store backing quelle unité, `NOSTROMO_PUSH_ORDER`, `NOSTROMO_PLAN_ORDER`, `isCollectionUnitName`.
- `payload.ts` — constructeurs d'enveloppes et gardes runtime (`readCollectionPayload`, `readPhotoPayload`), `describeError`.
- `restore-plan.ts` — listage paginé des documents distants, plan par unité avec avertissements et `requiresConfirmation`.
- `restore-apply.ts` — apply du plan : pull (collections relues puis appliquées, photos téléchargées/supprimées), overwrite (force-push local), settle des baselines/outbox/conflits.
- `sync-boot.ts` — boot unique : hydratation, statut initial dérivé, installation des retries.

UI : `src/components/bs-nostromo-sync/` (`bs-nostromo-sync-card.tsx` adaptateur, `bs-nostromo-status-chip.tsx`, `bs-nostromo-log-menu.tsx`, `bs-nostromo-restore-modal.tsx`, `bs-nostromo-status.ts` mappings purs), `src/components/app-bar/app-bar.tsx` (chip + menu de log), `src/pages/home.tsx` (carte Administration).

Stores touchés : les cinq collections `src/libs/stores/{players,teams,matchs,contacts,clubs}-store.ts` (chacun marque via son funnel `persistXxx`), `src/libs/trombi-titles-store.ts`, `src/libs/photo-store/photo-store.ts` (`storePhoto`/`deletePhoto`/`clearAllPhotos` marquent).

Docs : `AGENTS.md` (règles projet), `CONTRIBUTING.md` (setup une commande, backend), `TODO.md` (backlog parked, version courte), `docs/state-architecture.md` (pattern cible des stores, antérieur à la sync).

### Lancer en local

- `pnpm run dev` : le helper `scripts/dev.mjs` installe les dépendances, crée `.env` depuis `.env.example`, sonde `GET <VITE_NOSTROMO_URL>/api/health`, propose un menu (démarrer/backend, bootstrap), puis lance Vite sur le port 3000. Détails dans `CONTRIBUTING.md`.
- Backend : dépôt frère `~/workspace/nostromo`, `infra/pocketbase/scripts/serve.sh` (PocketBase sur `http://127.0.0.1:8090`) et `bootstrap.sh` (superuser `dev@nostromo.local` + utilisateur applicatif `app@nostromo.local`, mots de passe affichés une fois).
- Variable d'environnement : `VITE_NOSTROMO_URL` (défaut `.env.example` : `http://localhost:8090`), lue par `src/libs/nostromo/env.ts` et déclarée dans `src/vite-env.d.ts`.
- Vérifications : `pnpm run check` (Biome), `pnpm run typecheck`, `pnpm run test`.

### Invariants à ne pas casser

- Chaque store persiste exactement une fois par mutation et ne persiste **jamais** dans un `createEffect` (règles `docs/state-architecture.md` et `AGENTS.md`).
- La couche sync ne lit les collections qu'à travers les getters clonants (`getRawXxx`, `getTitles`) et n'hydrate jamais.
- L'export/import `.bstat` doit rester fonctionnel et indépendant de la sync.
- `version` (jeton serveur, incrémenté par écriture acceptée) est le seul jeton de conflit ; `updated` et `savedAt` sont de l'affichage.
- Le push automatique n'écrase jamais silencieusement une copie distante plus récente : sans baseline il adopte, avec baseline périmée il prend le 409 et parque.

### Comment ces findings ont été produits

Une revue thermo-nucléaire, une contre-revue, puis un smoke test live (7 scénarios) contre le backend local, suivis des corrections ; les items restants ont été délibérément parked. Le travail livré tient dans `git log --oneline 2e00afa..HEAD` (la feature sync proprement dite : `941c806` client+stores, `70fbe32` push, `da5067c` restore, `4355859` UI/boot, plus `280bef9` hygiène repo, `453a90c` dev setup une commande, `246f794` docs). Les corrections du cycle de revue ont été repliées dans ces commits squashés (attribution au cas par cas en bas de document).

---

## 1. Écrasement serveur silencieux (décision produit)

**Symptôme.** Les flux « tout remplacer » locaux passent par les funnels de persistance des stores, qui marquent chacun leur unité dirty. Le push automatique propage donc au serveur, ~10 s plus tard et sans nouvelle confirmation, un vidage ou un remplacement complet décidé localement. L'utilisateur croit vider/changer sa machine ; il vide/change aussi le serveur.

**Conditions de reproduction.**

1. Se connecter à Nostromo (carte Administration), laisser un premier push réussir pour poser des baselines.
2. Déclencher un remplacement complet local :
   - import `.bstat` avec confirmation « Écraser les données » (appelle `doClearDB()` puis `doOverwriteDB`), ou
   - seed de démo (« Peupler les données de démo », DEV seulement), ou
   - nettoyage partiel via le bouton « Grand nettoyage » (voir nuance ci-dessous).
3. Attendre ~10 s (debounce) sans fermer l'onglet : le flush envoie les collections vidées/remplacées et supprime les documents photo distants des photos effacées.
4. Observer côté serveur : les documents collection sont remplacés par le nouvel état (y compris vide), les documents photo supprimés. Une seconde machine qui restaure ensuite ne retrouve plus l'état d'avant. Le fichier `.bstat` sur disque, lui, est intact (c'est un téléchargement).

**Preuves.**

- Entrées de remplacement : `src/libs/orchestrator/orchestrator.ts:228` `doClearDB()` (`replaceAllPlayers([])` :230, `persistTitles({ ...DEFAULT_TITLES })` :236, `clearAllPhotos()` :237), `:240` `doOverwriteDB()` (appelé par `executeImport` :548), `:371` `replaceDataset()` (docstring « Atomically replace all domain data » :370). Appelants : `importDB` :604 (`doClearDB`) et `dev-bootstrap.ts:18` (`orchestrator.replaceDataset(seedDemoDataset())`).
- Propagation : `replaceAllXxx` appelle `persistXxx` qui appelle `markCollectionDirty` — `clubs-store.ts:46`, `players-store.ts:43`, `teams-store.ts:46`, `contacts-store.ts:48`, `matchs-store.ts:56` (docstring de `replaceAllClubs` : « imports, demo seed, big clean ») ; `persistTitles` marque `trombiTitles` (`trombi-titles-store.ts:24`) ; `clearAllPhotos` marque chaque photo (`photo-store.ts:33`). `markDirty` arme le debounce (`dirty-marks.ts:72-80`, `DIRTY_DEBOUNCE_MS = 10_000` :21).
- Nuance vérifiée sur le bouton « Grand nettoyage » : `home.tsx:24-30` (`runBigClean`) appelle `orchestrator.bigClean()` (`orchestrator.ts:389-410`), qui ne fait **pas** un vidage complet mais retire les joueurs morts des équipes et les contacts orphelins (`replaceAllTeams`/`replaceAllContacts` seulement si nettoyage) — ces remplacements partiels marquent aussi dirty et partent au serveur. Le vidage complet passe par l'import (deux `confirmAction`) ; le seed de démo par `replaceDataset`.
- Dialogues existants et ce qu'ils demandent réellement : `orchestrator.ts:594-597` `confirmAction('Importer les données', "Vous êtes sur le point d'importer N joueurs, N équipes, N matchs et N contacts.")` ; `:602` `confirmAction('Écraser les données', 'Voulez-vous écraser toutes les données ?')` ; `dev-bootstrap.ts:8-11` `confirmAction('Données de démo', 'Des données existent déjà. Écraser par le dataset de démonstration ?')` (`confirmAction` : `src/libs/utils/utils.ts:76`). Aucun ne mentionne le serveur Nostromo. Le bouton « Grand nettoyage » (`home.tsx:97-98`) n'a **aucune** confirmation.
- Le garde-fou vide-adopt ne protège que les appareils sans baseline : `push-engine.ts:242-248` (adoption sans envoi quand `countCollectionItems(unit) === 0`) ne s'applique qu'après un create refusé ; avec une baseline, `startDocument` (`:352-360`) envoie `updateDocument` avec la collection vide. Les photos supprimées localement entraînent une suppression distante (`pushDeletedPhoto` `:298-319`).
- Test couvrant la marque du wipe photo : `photo-store.test.ts:93` « marks every cleared photo unit dirty on clearAllPhotos ».

**Impact.** Perte de l'état serveur pré-wipe pour toute la flotte de machines (une seconde machine qui tire après le wipe récupère l'état post-wipe, plus l'état d'avant). Aucune trace locale du pré-wipe côté sync (baselines écrasées par le push réussi). Le `.bstat` sur disque reste le seul recours s'il existe.

**Périmètre.** Affecté : `doClearDB`, `doOverwriteDB`, `replaceDataset`, `bigClean` (propagation partielle), et par extension toute mutation massive. Non affecté : le push des éditions unitaires (comportement voulu), l'export `.bstat`, le restore Nostromo (qui, lui, demande confirmation via le plan).

**Questions ouvertes pour la session de design.**

- Un remplacement complet local doit-il se propager au serveur automatiquement, oui ou non ?
- Si oui, la boîte de dialogue existante doit-elle mentionner la propagation (« ceci sera aussi envoyé au serveur ») et/ou offrir un choix ?
- Le seed de démo (DEV) doit-il jamais toucher au serveur ?
- Le « Grand nettoyage » (nettoyage partiel) relève-t-il de la même décision ou d'une autre ?
- Que fait-on des machines tierces pendant la fenêtre : notifie-t-on, parque-t-on, ou rien ?

---

## 2. Statut `unconfigured` mort dans l'union `NostromoStatus`

**Symptôme.** Le membre `'unconfigured'` de `NostromoStatus` n'est produit par aucun chemin de code : tous les états « non configuré » écrivent `'off'`. Le membre et ses mappings UI sont du code mort, avec des tests qui continuent de le couvrir.

**Conditions de reproduction.** Aucune reproduction runtime : le statut ne peut jamais valoir `'unconfigured'`. Vérification statique uniquement (les mappings ne sont joignables que par les tests).

**Preuves.**

- Déclaration : `nostromo-sync-store.d.ts:4` (`'unconfigured'` dans `NostromoStatus`).
- Mappings UI qui le portent : `bs-nostromo-status.ts:42` (label `'Non configuré'`), `:54` (variante `'neutral'`), `:69` (message de flush `"Nostromo n'est pas configuré."`), `bs-nostromo-status-chip.tsx:33` (icône `CloudOff`).
- Producteurs qui n'écrivent que `'off'` : `sync-boot.ts:53` (`deriveBootStatus` : `if (!isConfigured()) return 'off'`), `dirty-marks.ts:75` (`markDirty` non configuré → `'off'`, commentaire : « "not configured" and "not synchronizing" are the same status, `off` »), `push-engine.ts:119` (`pushDirtyUnits` sans config → `'off'`).
- Tests qui l'assertent encore : `bs-nostromo-sync.test.tsx:125` (label), `:141` (liste des statuts), `:158-159` (`NOSTROMO_STATUS_VARIANTS.unconfigured` à `'neutral'`) ; `nostromo-sync-store.test.ts:139` (transitions de statut).
- Commentaire de module obsolète qui mentionne encore `unconfigured` : `dirty-marks.ts:14`.

**Impact.** Aucun comportement observable aujourd'hui : code mort, type trompeur (suggère un état « configuré mais désactivé » qui n'existe pas), surface de test qui verrouille le mort.

**Périmètre.** Affectés : l'union `NostromoStatus`, les trois maps UI, l'icône du chip, les tests listés. Non affecté : tout chemin runtime du sync store et du moteur de push.

**Questions ouvertes pour la session de design.**

- Un état « configuré mais désactivé » est-il prévu un jour (le membre redeviendrait vivant) ?
- Sinon, la suppression du membre est-elle purement mécanique, ou veut-on en profiter pour renommer `'off'` ?

---

## 3. Baseline photo écrite avec la version lue au moment du plan

**Symptôme.** Lors d'un pull, la baseline d'une photo est écrite avec la `version` du document telle que lue **au moment du plan**, pas au moment de l'apply. Une photo qui change côté serveur entre le plan et la confirmation laisse une baseline périmée : le prochain push de cette unité prend un 409 et parque un conflit que l'utilisateur doit résoudre à la main, alors que la copie locale est précisément celle qui vient d'être téléchargée.

**Conditions de reproduction.**

1. Configuré, avec une photo distante en version V.
2. Ouvrir un plan de restauration (le listing lit `version: V`).
3. Pendant que le modal est ouvert, faire évoluer le document photo côté serveur (autre machine, ou écriture directe) → version V+1.
4. Confirmer « Restaurer le serveur » : le blob V+1 (ou V selon le timing du download) est téléchargé, mais la baseline est écrite avec V.
5. Modifier la photo localement → push → `updateDocument` avec `expectedVersion: V` → 409 → unité parkée, statut `conflict`, log « Conflit sur photo:… ».

**Preuves.**

- La version du plan est figée au listing : `restore-plan.ts:297-302` (`NostromoRemoteSummary` construit avec `document.version` du listing ; docstring du type dans `restore.d.ts:29-30` : « Server-managed conflict token observed in the listing »).
- À l'apply, les **collections** relisent le document frais : `restore-apply.ts:408` (`getDocument(...)` dans `readCollectionUnits`) et `:418` (`version: document.version` relue). Les **photos** non : `pullPhotoUnit` `:440-463` télécharge le fichier mais retourne `{ docId: remote.docId, version: remote.version }` (`:462`) — la version du plan.
- Écriture de la baseline : `settleRestoredUnits` `:384-386` boucle `setBaseline(entry.unit, { ..., version: entry.version })`.
- Parking au 409 côté push : `push-engine.ts:138-140` (`parkConflictedUnit`) et `:452-454`, message « Conflit sur … l'élément reste en attente jusqu'à la résolution du conflit » (`:214-217`).
- Test couvrant le retour de version du pull photo (version du plan, pas d'une relecture) : `restore.test.ts:512` (`syncState.baselines[PHOTO_UNIT]` à la version du document servi au listing). Aucun test ne fait bouger le document entre plan et apply.

**Impact.** Conflit manuel injustifié (résolution via « Résoudre le conflit » de la carte), fréquence faible (fenêtre plan → confirmation) mais confusion réelle : l'utilisateur vient de choisir « restaurer le serveur » et se voit dire que sa copie fraîche est en conflit.

**Périmètre.** Affecté : uniquement les unités photo du pull (`pullPhotoUnit`). Non affectés : les collections (relues à l'apply), l'overwrite (qui écrit et reçoit la version serveur), le push normal.

**Questions ouvertes pour la session de design.**

- La version doit-elle être relue avant le téléchargement, après le téléchargement, ou déduite autrement ?
- Le même risque existe-t-il pour `remote.docId` (document supprimé entre plan et apply) et faut-il le traiter dans le même mouvement ?

---

## 4. `markCollectionDirty` après `await` dans le store des titres

**Symptôme.** Les cinq stores de collection marquent l'unité dirty **synchroniquement** dans leur funnel de persistance, en fire-and-forget sur l'écriture de stockage. `trombi-titles-store.ts` marque **après** avoir attendu `storeData(...)` : si cette écriture rejette (quota dépassé, navigation privée stricte), l'unité `trombiTitles` n'est jamais mise en file et la modification de titre ne partira jamais vers le serveur — silencieusement, tant que la session vit.

**Conditions de reproduction.**

1. Rendre `storeData(STORAGE_TROMBI_TITLES_KEY, ...)` rejetant (mock dans un test ; en vrai : quota/localStorage bloqué).
2. `await updateTitle('teamName', 'Les Lions')` → la promesse rejette, `markCollectionDirty('trombiTitles')` n'est jamais appelé.
3. L'outbox ne contient pas `trombiTitles` ; aucun push, aucun log sync, aucun statut.

**Preuves.**

- Store des titres : `trombi-titles-store.ts:21-25` :

```ts
async function persistTitles(newTitles: TrombiTitles): Promise<void> {
  setTitles({ teamName: newTitles.teamName })
  await storeData(STORAGE_TROMBI_TITLES_KEY, newTitles)
  markCollectionDirty('trombiTitles')
}
```

- Patron de référence (les cinq collections), `clubs-store.ts:42-47` :

```ts
function persistClubs(): void {
  storeClubs(getRawClubs()).catch((error: unknown) => {
    console.error('storeClubs failed:', error)
  })
  markCollectionDirty('clubs')
}
```

  Mêmes formes en `players-store.ts:41-44`, `teams-store.ts:42-47`, `contacts-store.ts:44-48`, `matchs-store.ts:52-56`.
- Test existant (couvre le chemin heureux uniquement) : `trombi-titles-store.test.ts:27` « marks the trombiTitles unit dirty after the titles were persisted » — le titre du test dit lui-même « after … persisted ».
- Photo-store : `storePhoto`/`deletePhoto` marquent après leur `await` IndexedDB (`photo-store.ts:11-23`) — même forme que les titres, mais l'écriture idb est déjà le I/O métier lui-même.

**Impact.** Perte de synchronisation silencieuse du titre d'équipe tant que l'app vit ; au rechargement suivant, la valeur non persistée localement est de toute façon perdue (le store relit localStorage), ce qui borne l'incohérence mais laisse une fenêtre « affiché localement, jamais envoyé ».

**Périmètre.** Affecté : `trombiTitles` uniquement (et, par homologie de forme, `photo-store` si l'on juge que ses `await set/del` méritent le même traitement). Non affectés : les cinq collections.

**Questions ouvertes pour la session de design.**

- La marque doit-elle précéder l'écriture de stockage, suivre son échec, ou les deux stores (titres, photos) doivent-ils converger vers un seul patron ?
- Que doit voir l'utilisateur quand la persistance locale échoue (statut sync, toast, rien) ?

---

## 5. Reliquats de documents distants

**Symptôme.** Deux reliquats côté serveur subsistent quand l'état local se vide ou disparaît hors des chemins couverts : (a) un document photo distant survit quand le blob local disparaît **sans** passer par `deletePhoto`/`clearAllPhotos` (stockage navigateur purgé, données de site effacées, appareil restauré) — une restauration ultérieure re-télécharge alors des photos que l'appareil ne détient plus (résurrection) ; (b) une collection dont les données locales sont vidées n'est reconciliée avec le serveur que via le chemin d'adoption (`startDocument` → create refusé → adopt), qui ne s'applique qu'aux appareils **sans** baseline — le document reste donc en place côté serveur après un vidage volontaire sur un appareil qui vient de pousser du vide (chevauchement avec le finding 1).

**Conditions de reproduction.**

- (a) Résurrection : pousser des photos (documents créés), puis purger IndexedDB du navigateur sans désinstaller (les baselines persistent en localStorage) → aucune marque, rien dans l'outbox, les documents photo restent sur le serveur → « Restaurer le serveur » re-télécharge toutes les photos, y compris celles de joueurs absents localement (`storePulledPhoto` écrit le blob même sans joueur local : `restore-apply.ts:474-477`).
- (b) Document collection résiduel : appareil avec baselines, vider la collection locale par un chemin qui ne marque pas (hors périmètre actuel : les vides passent par `replaceAllXxx` qui marque — le cas réel est un appareil neuf ou un localStorage partiellement perdu), ou simplement observer qu'aucun mécanisme ne compare « serveur détient un document que le local considère vide » en dehors de l'adoption au push.

**Preuves.**

- Ce qui EST couvert aujourd'hui :
  - Suppression locale → suppression distante : `deletePhoto` marque (`photo-store.ts:20-23`) → `pushDeletedPhoto` supprime le document distant (`push-engine.ts:298-319`), tolérant au 404 (`deleteRemoteDocument` `:322-331`). Tests : `push-engine.test.ts:537` « deletes the remote document of a photo whose local copy was deleted », `:554` (404 déjà parti), `:569` (échec de suppression distante → unité gardée en file).
  - Garde-fou appareil neuf : adoption sans envoi du défaut vide `push-engine.ts:242-248` (« Document existant de … adopté … sans envoyer de données locales vides »). Tests : `:270` (collection vide), `:293` (titre vide).
  - Le wipe **in-app** marque tout : `clearAllPhotos` marque chaque photo (`photo-store.ts:29-35`, test `photo-store.test.ts:93`), donc ses suppressions distantes partent (c'est le finding 1).
- Ce qui N'EST PAS couvert :
  - Blob disparu sans marque : `pushDeletedPhoto` n'est atteint que pour une unité **dans l'outbox** ; sans baseline, il ne supprime rien (`push-engine.ts:304-308` : « sans baseline rien n'est connu du serveur : l'unité est simplement retirée de la file »).
  - Overwrite ne supprime jamais les photos distantes : documenté en tête de `applyNostromoOverwrite` (`restore-apply.ts:166-167` « Local photos are never deleted here ») et testé `restore.test.ts:917` « never deletes a remote photo the device no longer holds ».
  - Aucun balayage plan/apply ne propose le nettoyage des documents photo sans équivalent local : le pull ne fait que télécharger (`pullPhotoUnit`), la suppression locale ne vise que l'inverse (photo locale sans copie serveur, `restore-apply.ts:443-449`).

**Impact.** Divergence silencieuse local ↔ serveur : stockage serveur occupé par des photos fantômes, résurrections au restore, compteur `remotePhotoCount` du plan gonflé (`describeNostromoPlan` affiche « N photos à reprendre »). Pas de perte de données locales.

**Périmètre.** Affectés : documents photo orphelins côté serveur, documents collection vides vs serveur non vide (hors adoption). Non affectés : le chemin de suppression in-app, le garde-fou appareil neuf, l'overwrite (choix documenté de ne pas supprimer).

**Questions ouvertes pour la session de design.**

- La v1 reconcilie-t-elle ces reliquats (comparaison au flush, action explicite « nettoyer le serveur » depuis la carte), ou assume-t-elle la dérive en la documentant ?
- La résurrection au pull (photo d'un joueur absent localement) est-elle un bug ou une feature (préparation d'un import joueurs) ?
- L'overwrite doit-il rester non-suppressif pour les photos ?

---

## 6. Divers P3 de revue

**Symptôme.** Six points relevés en revue, sans impact fonctionnel bloquant, un bloc chacun.

- **Titre du modal inconditionnel** : `bs-nostromo-restore-modal.tsx:55` affiche toujours « Vous allez écraser des données plus récentes. » (classe `text-warning`) dès que le modal est ouvert. Or le modal s'ouvre aussi pour un plan dont les confirmations ne viennent que de changements locaux en attente (`restore-plan.ts:222-225` : « des changements locaux sont en attente d'envoi, la restauration les abandonne » → `requiresConfirmation: true` sans copie serveur plus récente) ou via « Résoudre le conflit » (`bs-nostromo-sync-card.tsx:164-166`, `openRestorePlan(true)` force le modal `:178`). Le titre affirme alors un fait faux.
- **Une écriture de baseline par unité au restore** : `settleRestoredUnits` boucle `setBaseline` (`restore-apply.ts:384-386`), et chaque appel persiste (`nostromo-sync-store.ts:166-171` → `persistBaselines` `:265-269`, un `storeData` par appel). Un restore de 6 collections + N photos = 6+N écritures de `BS_NOSTROMO_BASELINES` plus une pour l'outbox (`dropRestoredFromOutbox` `:671-682`), pour une opération logiquement unique.
- **Cast résiduel** : `push-engine.ts:197` `unit as NostromoUnitName` alors que le garde `isCollectionUnitName` existe (`units.ts:150-152`) et est déjà utilisé en `:168`.
- **Type exporté sans lecteur** : `NostromoPushUnit` (`push-engine.d.ts:36`) — aucune référence hors son fichier de déclaration (grep du 2026-09-18 : aucun usage).
- **Types d'enveloppe hébergés loin de leurs constructeurs** : `NostromoCollectionPayload` / `NostromoPhotoPayload` vivent en `push-engine.d.ts:14` et `:22` alors que leurs constructeurs sont `buildCollectionPayload` / `buildPhotoPayload` en `payload.ts:70` et `:75` (qui les importe de `push-engine.d` en `payload.ts:21`).
- **Export inutile** : `toClientError` (`restore-plan.ts:412`) n'est utilisé qu'en interne (`:74`, même fichier).

**Conditions de reproduction.** Statique / inspection. Le titre du modal s'observe en ouvrant « Résoudre le conflit » avec un plan dont les seules alertes sont des changements locaux en attente.

**Preuves.** Pointeurs ci-dessus, vérifiés à HEAD `246f794`. Test couvrant le rendu du modal (titre non conditionné) : `bs-nostromo-sync.test.tsx` (suite du composant).

**Impact.** Cosmétique/maintenabilité ; le titre inconditionnel est le seul point perceptible par l'utilisateur (message d'avertissement mensonger).

**Périmètre.** Affectés : le composant modal, `settleRestoredUnits`/`setBaseline`, `push-engine.ts:197`, `push-engine.d.ts`, `payload.ts`, `restore-plan.ts`. Non affecté : tout comportement runtime en deçu du libellé du modal et du nombre d'écritures localStorage.

**Questions ouvertes pour la session de design.**

- Le titre du modal doit-il dériver des unités réellement destructrices du plan (et avec quel libellé quand seule la perte de changements locaux est en jeu) ?
- Un setter groupé de baselines a-t-il sa place dans le sync store, ou le fan-out d'écritures est-il assumé ?

---

## 7. Findings de vérification qui restent ouverts

Sept points issus de la revue/contre-revue/smoke, vérifiés contre le code, sans décision prise.

### 7.1 Flush en vol pendant un restore

**Symptôme.** Aucun verrou n'exclut un `flushNostromoPush` en cours d'un `applyNostromoRestore` qui démarre : le flush peut écrire des unités que le restore remplace juste après, et le settle final peut écraser une baseline que le flush vient de rafraîchir (ou l'inverse).

**Preuves.** `flushNFlight` ne déduplique que les flushs entre eux (`push-engine.ts:88-97`, `:99`). Mitigations existantes : le restore annule le debounce avant sa première écriture (`restore-apply.ts:132` `cancelDirtyDebounce()`, commentaire « A debounce armed by an earlier local change is about to push units this run replaces ») et le settle retire les unités restaurées de l'outbox (`:390`, `dropRestoredFromOutbox` `:671-682`) ; le run logue l'avertissement « des changements étaient en attente d'envoi avant la reprise ; un envoi a pu s'exécuter pendant la restauration » (`:151-156`). Fenêtre résiduelle : un flush déjà engagé (liste d'unités figée en `selectPushableUnits` `:112` à l'entrée de `pushDirtyUnits`) continue pendant tout le restore ; l'ordre d'écriture des baselines (commit du flush `commitUnitBaseline` `:414-429` vs `settleRestoredUnits` `:384-386`) décide laquelle des deux versions survit — la perdante rend le prochain push 409.

**Questions ouvertes.** Faut-il un verrou partagé flush/restore, un statut bloquant, ou la fenêtre est-elle assumée avec son log actuel ?

### 7.2 Marque dirty rétrogradant `auth-required` en `pending`

**Symptôme.** `markDirty` écrit `'pending'` dès qu'une config existe (`dirty-marks.ts:78`), sans lire le statut courant : un statut terminal `'auth-required'` est rétrogradé en « En attente » pendant la fenêtre de debounce (10 s) ou jusqu'au prochain essai (intervalle `NOSTROMO_RETRY_INTERVAL_MS = 60_000`, `push-engine.ts:66`), qui re-établira `'auth-required'` au 401.

**Preuves.** `dirty-marks.ts:72-80` (aucune lecture du statut courant) ; producteurs de `'auth-required'` : `push-engine.ts:135`, `restore-apply.ts:666`, `restore-plan.ts:76`, `bs-nostromo-sync-card.tsx:94`. Labels UI concernés : « Reconnexion requise » vs « En attente » (`bs-nostromo-status.ts:35`, `:40`).

**Questions ouvertes.** La marque doit-elle préserver les statuts terminal d'action requise ? Le chip doit-il refléter deux dimensions (file non vide + session à renouveler) ?

### 7.3 Restore fini en `saved` avec une outbox non vide

**Symptôme.** `resultStatus` (`restore-apply.ts:227-232`) ne regarde que conflits et échecs : si une écriture de store **pendant** le run a marqué une unité que le run n'a pas appliquée, le run se termine en `'saved'` alors que l'outbox n'est pas vide.

**Preuves.** Exemple concret vérifié : une collection `players` **sans** document distant est skippée par le pull (`readCollectionUnits` `:402-404`, `report.skipped`), puis la phase photos appelle `updatePlayer` pour maintenir `hasPhoto` (`storePulledPhoto` `:479`, `deletePulledPhoto` `:490`) → `persistPlayers` marque `'players'` (`players-store.ts:43`) ; le settle ne retire que `applied` + `deletedPhotos` (`:381`), donc `players` reste en file, et `resultStatus(false, 0)` renvoie `'saved'` (`:146`). À comparer au push engine, dont `finalStatus` tient compte du restant (`push-engine.ts:180-189`). Le test « removes the restored units from the outbox… » (`restore.test.ts:659-672`) ne couvre pas ce cas (players y est appliqué).

**Questions ouvertes.** `resultStatus` doit-il dériver du reste de l'outbox comme `finalStatus` ? Le statut post-restore doit-il distinguer « restauré, envoi local en attente » ?

### 7.4 Deux documents revendiquant la même unité sous des ids différents

**Symptôme.** Lors d'un overwrite explicite, si le plan a retenu le document le plus récent (id A) alors que la baseline locale pointe l'autre (id B), `resolveOverwriteTarget` choisit la cible baseline (B + `localBaseline.version`) : l'écriture peut échouer en 404 (B supprimé entre-temps) ou 409 (B a bougé), et l'unité reste en échec/conflit alors que l'utilisateur a demandé un écrasement explicite.

**Preuves.** Regroupement du plan : `keepNewestDocument` garde le plus récent et avertit « plusieurs documents distants revendiquent …, la version N est conservée » (`restore-plan.ts:179-194`, avertissement `:193`). Choix de cible : `resolveOverwriteTarget` (`restore-apply.ts:604-613`) — si `localBaseline.docId !== remote.docId`, la branche baseline l'emporte (`:609-611`). Test existant : uniquement le niveau plan (`restore.test.ts:424-434` « keeps the newest document when several claim the same unit, and warns ») ; aucun test overwrite avec `docId` de baseline divergent.

**Questions ouvertes.** En cas de documents multiples, l'overwrite doit-il viser le document du plan, celui de la baseline, ou les deux ? Le document perdant doit-il être signalé/supprimé ?

### 7.5 Branches de validation de payload quasi non couvertes par les tests

**Symptôme.** Les gardes de `payload.ts` n'ont aucun test direct : aucun fichier de test n'importe `readCollectionPayload`/`readPhotoPayload`/`toPayloadRecord` (grep du 2026-09-18 : zéro hit). Couverture indirecte seulement : `restore.test.ts:537-555` (items non-liste + schéma erroné, via « skips and logs a unit whose remote payload fails the runtime guard ») et `:277-283` (payload inconnu / absent, via le test de regroupement). Branches sans aucun test : photo payload invalide (les raisons de `readPhotoPayload` `payload.ts:118-130`), titre invalide (« la charge utile ne porte aucun objet de titre » `:105`), entrée sans id (« une entrée … n'est pas un objet portant un id » `:112`), nom de collection divergent (« ne décrit pas la collection … » `:95`).

**Questions ouvertes.** Un fichier `payload.test.ts` dédié est-il voulu, ou la couverture via restore/push suffit-elle ?

### 7.6 `restore.test.ts` remplace le sync store par un miroir en mémoire

**Symptôme.** `restore.test.ts` mocke `./nostromo-sync-store` avec un objet `syncState` en mémoire (`restore.test.ts:47-94`) : la logique de settle (fan-out `setBaseline`, `dropRestoredFromOutbox`, interaction avec `clearUnitDirtyIfUnchanged`) est validée contre le mock, pas contre le vrai store. Une régression interne au vrai store (p. ex. la subtilité du setter racine de `replaceBaselines`, `nostromo-sync-store.ts:156-163`) ne serait pas attrapée par cette suite.

**Preuves.** Mock : `restore.test.ts:74-94` (avec son propre `setDirtyUnits` dédupliquant, `:88-90`) ; commentaire d'en-tête : « the mocked module reads and writes exactly like the real one does » (`:43-46`). Le vrai store a sa suite (`nostromo-sync-store.test.ts`) mais aucune suite croisée restore × vrai store.

**Questions ouvertes.** Faut-il un test d'intégration restore + vrai sync store (sous `vitest` avec le localStorage mocké du store), ou le risque est-il accepté ?

---

## Déjà traité (ne pas refaire)

- `.env` ignoré (`.gitignore`, `.env.example` template) — `280bef9`.
- Routes mortes `/user` et `/users` supprimées (avec le menu associé) — `280bef9`.
- Passe de francisation de l'UI restante — `280bef9`.
- Setup dev en une commande (`scripts/dev.mjs`, README, CONTRIBUTING) — `453a90c`.
- Docs projet (`AGENTS.md` règles + `TODO.md` backlog parked) — `246f794` ; README/CONTRIBUTING — `453a90c`.
- Corrections du cycle de revue, repliées dans les commits squashés de la feature :
  - perte de marque dirty pendant un push en vol (garde par révision `clearUnitDirtyIfUnchanged`) — `70fbe32` (`push-engine.ts:243-250`, `:422` ; test « keeps a unit queued when it is marked again while its push is in flight »).
  - suppression du document photo distant quand la copie locale disparaît (`pushDeletedPhoto`) — `70fbe32` (`push-engine.ts:298-331`).
  - settle des unités déjà écrites lors d'un pull avorté (401) — `da5067c` (`restore-apply.ts:137-143`).
  - getter clonant des titres (`getTitles`) — `70fbe32` (`trombi-titles-store.ts:36-38`).
  - modèle d'unités à source unique (`units.ts`, partagé push/restore) — `70fbe32`.
  - persistance du parking de conflit (flag `conflicted` sur la baseline, survit au rechargement) — introduit avec le store `941c806` (`nostromo-sync-store.d.ts:46-53`, `getConflictedUnits`).
  - écrasement explicite avec la version fraîche du plan (`resolveOverwriteTarget` utilise `remote.version`) — `da5067c` (`restore-apply.ts:604-613` ; test « keeps a stale unit conflicted … when the server moved again since the plan »).
  - garde-fou d'adoption à vide (appareil neuf) — `70fbe32` (`push-engine.ts:242-248`).
  - borne de lecture IndexedDB du plan (`NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS`) — `da5067c` (`restore-plan.ts:44`, `:380-395`).
