# Ambient Tasks

> File d'attente de tâches pour le travail proactif ambient.
> Ce fichier est versionné dans git et partagé entre les machines.
> Voir le skill `ambient-tasks` pour le format et les règles détaillées.

## Pending

<!-- Ajoute les tâches ici. Format: - [ ] [Pn] Description -->

- [ ] [P1] Reduce `pnpm run check` errors (258 currently, breaks the ambient "check must pass" gate). Breakdown: 103 lint/style/useConsistentMemberAccessibility, 25 lint/style/noExportedImports + 23 lint/performance/noBarrelFile (index.ts barrels), ~40 useConsistentArrayType/useConsistentTypeDefinitions/useOptionalChain/useReadonlyClassProperties (mostly auto-fixable via `pnpm run fix`), 7 lint/suspicious/useAwait, 2 unused biome-ignore suppressions in src/components/combobox/combobox.tsx, a11y one-offs. Suggest incremental PRs per rule family, starting with auto-fixable ones.
- [ ] [P2] Add unit tests for `src/libs/utils/utils.ts` — clone, getShortId, getUniqId, downloadBlob, confirmAction, toDateTime, toast have no coverage (only file in src/libs without a test). DOM-dependent functions need jsdom mocking (URL.createObjectURL, document.createElement, window.scrollTo).

## In Progress

<!-- Tâches en cours d'exécution par un agent -->

_Vide_

## Done

<!-- Tâches terminées (historique récent) -->

- [x] [P2] ~~Add tests for `src/libs/contact/contact.ts`~~ — contact.test.ts exists
- [x] [P2] ~~Add tests for `src/libs/match/championship-util.ts`~~ — championship-util.test.ts exists
- [x] [P3] ~~Add tests for `src/libs/rolling-number.ts`~~ — rolling-number.test.ts exists
- [x] [P3] ~~Add a README.md at the project root~~ — README.md exists (92 lines, badges + scripts + structure)

## Abandoned

<!-- Tâches abandonnées avec raison -->

_Vide_
