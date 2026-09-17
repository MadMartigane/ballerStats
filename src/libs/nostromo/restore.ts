/**
 * Public entry point of the pull half of the Nostromo synchronization: plan a
 * restore, then apply the decision the user made.
 *
 * The implementation is deliberately split in two, because the two halves have
 * opposite rules:
 *
 * - `./restore-plan` reads: it lists the remote documents and builds a plan
 *   without writing anything,
 * - `./restore-apply` writes: it pulls, overwrites and settles the units, and is
 *   the only module that mutates a store or a baseline.
 *
 * This module re-exports both so the UI and the tests keep one import path for
 * the whole restore.
 */
// biome-ignore lint/performance/noBarrelFile: the documented entry point of the restore half, not a barrel.
export { applyNostromoOverwrite, applyNostromoRestore, confirmNostromoRestore } from './restore-apply'
export { planNostromoRestore } from './restore-plan'
