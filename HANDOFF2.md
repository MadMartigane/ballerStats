# HANDOFF 2 — Finalisation

**Date :** 2026-09-05

## Sessions
- **Session 1** : T1–T6 + 8 audits thermo-nuclear (P0=0, P1 2→1)
- **Session 2** : reprise P1/P2, 8 cycles Phase-A

## Workflow actuel
- Batch code-only T1+T2 → tests → check/typecheck/test/build
- Audit thermo-nuclear Phase-A (P0/P1/P2, zero-tolerance, max 8) → Phase-B (P3) → code-smoke final
- Ne jamais modifier soi-même ; audits sur `git diff` uniquement

## Blocage structurel
1. **Zero-tolerance + scope diff** : toutes lignes ajoutées/modifiées auditées ; chaque fix élargit la surface → oscillation (fixer un P2 en crée 2 nouveaux : stable source → stale snapshot → draft isolation → god object → speculative API…)
2. **Dérive des findings** : du bug initial vers refonte architecturale (draft staging edit-mode, atomicité single-assignment, ownership Contacts vs Orchestrator, bus-hooks générique) — hors scope HANDOFF d'origine
3. **Cap 8 épuisé** avec 1 P1 + 5 P2 restants :
   - `orchestrator.ts:485` — atomicité
   - `orchestrator.ts:520` — snapshot draft
   - `players.tsx:41` — reset source
   - `player-batch.ts:91` — ownership
   - `bus-hooks.ts:18` — stale subscribe + duplication orchestration

## Recommandation
- **Geler l'élargissement** ; accepter l'atomicité pragmatique actuelle (validée : 204 tests + check/typecheck verts)
- **OU** scoper une session 3 uniquement sur le P1 atomicité `register` ; reporter les P2 en dette technique

## Validation
- check / typecheck / test verts
- Aucun commit
