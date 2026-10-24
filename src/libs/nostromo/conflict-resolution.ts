/**
 * Per-unit resolution of a parked conflict.
 *
 * A conflict is per document and each collection is one document, so a choice
 * always concerns a whole collection. Both choices are destructive for one side
 * and are therefore confirmed before anything is touched:
 *
 * - `keep-local` overwrites the server copy: the current server version is read
 *   again, becomes the baseline, the unit stays dirty and a flush pushes it,
 * - `take-server` discards the local copy: the server payload is validated, applied
 *   without marking the unit dirty, and becomes the baseline.
 */
import { confirmAction } from '../utils/utils'
import { getDocument } from './client'
import { getConfig } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  clearUnitDirty,
  getBaseline,
  getConflictedUnits,
  getDirtyUnits,
  isUnitDirty,
  markUnitDirty,
  pushNostromoLog,
  setBaseline,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoStatus } from './nostromo-sync-store.d'
import { readCollectionPayload } from './payload'
import { flushNostromoPush } from './push-engine'
import { applyCollectionPayloadSilently, isCollectionUnitName } from './units'

export type ConflictChoice = 'keep-local' | 'take-server'

const CONFIRM_TITLE = 'Conflit de synchronisation'
const CONFIRM_KEEP_LOCAL = 'Remplacer la copie du serveur par celle de cet appareil ?'
const CONFIRM_TAKE_SERVER = 'Remplacer les données de cet appareil par celles du serveur ?'

/** Resolves the parked conflict of one unit. A declined confirmation changes nothing. */
export async function resolveConflict(unit: string, choice: ConflictChoice): Promise<void> {
  const config = getConfig()
  if (!config) {
    throw new Error(`Impossible de résoudre le conflit de « ${unit} » : Nostromo n'est pas configuré.`)
  }
  const message = choice === 'keep-local' ? CONFIRM_KEEP_LOCAL : CONFIRM_TAKE_SERVER
  if (!(await confirmAction(CONFIRM_TITLE, message))) {
    return
  }

  try {
    if (choice === 'keep-local') {
      await keepLocal(config, unit)
    } else {
      await takeServer(config, unit)
    }
  } finally {
    setNostromoSyncStatus(settledStatus())
  }
}

async function keepLocal(config: NostromoConfig, unit: string): Promise<void> {
  const server = await getDocument(config.baseUrl, config.token, docIdOf(unit))
  // Writing a baseline without the `conflicted` flag unparks the unit.
  setBaseline(unit, { docId: server.id, savedAt: Date.now(), version: server.version })
  if (!isUnitDirty(unit)) {
    markUnitDirty(unit)
  }
  pushNostromoLog('info', `Conflit de « ${unit} » résolu : les données de cet appareil sont conservées.`)
  await flushNostromoPush()
}

async function takeServer(config: NostromoConfig, unit: string): Promise<void> {
  if (!isCollectionUnitName(unit)) {
    throw new Error(
      `Impossible de reprendre « ${unit} » depuis le serveur : seules les collections sont prises en charge.`
    )
  }
  const server = await getDocument(config.baseUrl, config.token, docIdOf(unit))
  const read = readCollectionPayload(server.payload, unit)
  if (read.kind === 'invalid') {
    throw new Error(`La charge utile de « ${unit} » est refusée (${read.reason}).`)
  }
  await applyCollectionPayloadSilently(read)
  setBaseline(unit, { docId: server.id, savedAt: Date.now(), version: server.version })
  clearUnitDirty(unit)
  pushNostromoLog(
    'info',
    `Conflit de « ${unit} » résolu : les données du serveur (version ${server.version}) sont appliquées.`
  )
}

/** Document id kept by the parked baseline: the unit key alone does not give it for photos. */
function docIdOf(unit: string): string {
  const baseline = getBaseline(unit)
  if (!baseline) {
    throw new Error(`Aucune référence serveur pour « ${unit} ».`)
  }
  return baseline.docId
}

/** Status after a resolution: `conflict` while a unit stays parked, else `pending` or `saved`. */
function settledStatus(): NostromoStatus {
  if (getConflictedUnits().length > 0) {
    return 'conflict'
  }
  return getDirtyUnits().length > 0 ? 'pending' : 'saved'
}
