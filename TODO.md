# TODO — décisions en attente

Ce fichier regroupe le travail volontairement mis de côté : ce ne sont pas des bugs à oublier, mais des **décisions à prendre**. Chaque item décrit le contexte, la décision attendue et les emplacements de code exacts concernés. Un item se supprime quand la décision est prise et appliquée, pas quand on l'a relu.

Le détail de chaque sujet (symptômes, reproduction, preuves vérifiées) est dans `HANDOFF.md` ; ce fichier-ci reste la liste courte des décisions à prendre.

## 1. Écrasement serveur silencieux (décision produit)

Les flux « tout écraser », import et seed de démo passent par les funnels de persistance des stores, qui appellent chacun `markCollectionDirty`. Le sync Nostromo arme donc un push et propage un écrasement complet au serveur **sans confirmation explicite** : l'utilisateur croit vider sa machine, il vide aussi le serveur.
Décision : soit supprimer la propagation pour ces flux (remplacement qui hydrate sans marquer dirty), soit ajouter « propager au serveur ? » dans la boîte de confirmation existante.
Pointers : `src/libs/orchestrator/orchestrator.ts:228` (`doClearDB()`), `:240` (`doOverwriteDB()`), `:371` (`replaceDataset()`), appelants `:548` et `:604` ; seed de démo `src/libs/mock/dev-bootstrap.ts:18` ; funnels `src/libs/stores/clubs-store.ts:42`, `src/libs/trombi-titles-store.ts:21`, `src/libs/photo-store/photo-store.ts:20` ; dialogues `orchestrator.ts:585` et `:592`, `dev-bootstrap.ts:8` (`confirmAction` dans `src/libs/utils.ts:76`).

## 2. Statut `unconfigured` mort dans la couche sync

L'union `NostromoStatus` porte encore `'unconfigured'`, mais plus rien ne le produit : tous les chemins « non configuré » écrivent `'off'`. Le membre et ses mappings UI sont donc du code mort, avec des tests qui les couvrent encore.
Décision : retirer le membre et ses mappings (libellé, variante, message de flush, icône du chip, attentes de tests), ou le conserver si un état « configuré mais désactivé » est prévu.
Pointers : union `src/libs/nostromo/nostromo-sync-store.d.ts:4` ; mappings `src/components/bs-nostromo-sync/bs-nostromo-status.ts:42`, `:54`, `:69` et `bs-nostromo-status-chip.tsx:33` ; producteurs qui ne rendent que `'off'` : `src/libs/nostromo/sync-boot.ts:53`, `dirty-marks.ts:75`, `push-engine.ts:119` ; tests `bs-nostromo-sync.test.tsx:141` et `:158`, `nostromo-sync-store.test.ts:139`.

## 3. Baseline photo datée du plan

`pullPhotoUnit` télécharge le blob au moment de l'application, mais renvoie la `version` lue **au moment du plan** (`remote.version`), et `settleRestoredUnits` écrit cette version dans la baseline. Si le document distant a bougé entre le plan et la confirmation, la baseline est déjà périmée et le prochain push parque un conflit alors que la copie locale est justement celle qui vient d'être téléchargée.
Décision : relire la version du document au moment de l'application (ou après le téléchargement) avant d'écrire la baseline.
Pointers : `src/libs/nostromo/restore-apply.ts:428` (`pullPhotoUnit`) et `:450` (retour avec `remote.version`), version figée dans le plan en `restore-plan.ts:307`, écriture de la baseline en `restore-apply.ts:375`.

## 4. `markCollectionDirty` asynchrone dans le store des titres

`trombi-titles-store.ts` attend `storeData(...)` puis marque l'unité dirty, alors que les cinq stores de collection marquent **synchroniquement** dans leur helper `persistXxx`. Un échec d'écriture (quota, navigation privée) laisse donc l'unité hors de l'outbox : la modification ne partira jamais vers le serveur.
Décision : marquer indépendamment de l'`await`, comme les stores de collection.
Pointers : `src/libs/trombi-titles-store.ts:21` (le `await` puis `markCollectionDirty` en `:24`) ; patron de référence `src/libs/stores/clubs-store.ts:42-47`.

## 5. Reliquats serveur (P3)

Deux reliquats subsistent côté serveur quand le local se vide. Une collection dont les données locales sont vidées **adopte** le document existant sans y toucher (garde-fou voulu pour un appareil neuf, mais qui laisse aussi le document en place après un vidage volontaire) ; et un document photo distant survit quand le blob local disparaît hors du chemin de push (stockage navigateur purgé, appareil restauré), seul `pushDeletedPhoto` le supprimant, et uniquement pour une unité marquée dirty sans blob local.
Décision : dire si la v1 réconcilie ces reliquats (action explicite « nettoyer le serveur », ou comparaison au flush) ou assume la dérive en la documentant.
Pointers : `src/libs/nostromo/push-engine.ts:242` (collection vide adoptée), `:294` (`pushDeletedPhoto`), `:322` (`deleteRemoteDocument`), `src/libs/photo-store/photo-store.ts:20` et `:31` ; suppression purement locale au restore `src/libs/nostromo/restore-apply.ts:434`.

## 6. Divers P3 de revue

Points relevés en revue, sans impact fonctionnel bloquant :
- Titre du modal de restore inconditionnel : `bs-nostromo-restore-modal.tsx:55` affiche « Vous allez écraser des données plus récentes. » même pour un plan non destructif ; le conditionner aux unités réellement destructrices du plan.
- Une écriture de baseline par unité pendant un restore : boucle `restore-apply.ts:375` et `setBaseline` qui persiste à chaque appel (`nostromo-sync-store.ts:166`) ; un setter groupé écrirait une fois par run.
- Cast résiduel `unit as NostromoUnitName` en `push-engine.ts:197` alors que le garde de type `isCollectionUnitName` existe déjà (`units.ts:150`).
- Type `NostromoPushUnit` sans lecteur (`push-engine.d.ts:36`).
- Types d'enveloppe de payload (`NostromoCollectionPayload`, `NostromoPhotoPayload`, `push-engine.d.ts:14` et `:22`) hébergés avec le moteur alors que leurs constructeurs sont dans `payload.ts:70` et `:75`.
- `restore-plan.ts:416` exporte `toClientError`, utilisé uniquement en interne (`:74`).
