/**
 * Plan half of the Nostromo restore: describe, without writing anything, what
 * pulling the remote documents would change locally.
 *
 * `planNostromoRestore()` lists the remote documents, reads the local
 * collections and photos, and returns one plan entry per unit: the remote state,
 * the local state, the warnings the user must read and whether those warnings
 * require a confirmation before anything is written. A plan never writes: no
 * store, no baseline, nothing but sync log lines.
 *
 * It also holds the three helpers the two halves of the restore share: how the
 * configuration is required, and how a refused session is told apart from a
 * per-unit failure.
 */
import { getAllPhotoEntries } from '../photo-store/photo-store'
import type { PhotoEntry } from '../photo-store/photo-store.d'
import { NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import { photoUnitName } from './dirty-marks'
import { listAllRemoteDocuments } from './listing'
import { getConfig } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import { getAllBaselines, isUnitDirty, pushNostromoLog, setNostromoSyncStatus } from './nostromo-sync-store'
import type { NostromoBaselines, NostromoUnitName } from './nostromo-sync-store.d'
import { type CollectionPayloadRead, readCollectionPayload, readPhotoPayload, toPayloadRecord } from './payload'
import type {
  NostromoCollectionPlanUnit,
  NostromoPhotoPlanUnit,
  NostromoRemoteSummary,
  NostromoRestorePlan,
} from './restore.d'
import { countCollectionItems, isCollectionUnitName, NOSTROMO_PLAN_ORDER } from './units'

/**
 * Bound of the local photo enumeration. IndexedDB can stop answering without ever
 * rejecting (an upgrade blocked by another tab, a transaction whose callback never
 * runs): past this bound the plan degrades instead of hanging.
 */
export const NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS = 10_000

/** Warning of a plan whose local photo enumeration was abandoned. */
const LOCAL_PHOTO_READ_TIMEOUT_WARNING = `le stockage local des photos n'a pas répondu en ${NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS} ms, les photos locales sont ignorées par ce plan.`

/** Remote documents grouped by unit, plus what the grouping had to ignore. */
interface RemoteGroups {
  /** Collection documents, keyed by the `name` of their payload. */
  collections: Map<string, NostromoDocument>
  /** Photo documents, keyed by the `playerId` of their payload. */
  photos: Map<string, NostromoDocument>
  warnings: string[]
}

/**
 * Builds the restore plan: one listing of the remote documents, then a purely
 * local comparison against the baselines, the collections and the photos.
 *
 * Throws a `NostromoClientError` when the listing itself fails, since no plan can
 * be built from nothing: the status is set to `auth-required` on a refused
 * session, `error` otherwise. Every other problem is reported as a warning
 * inside the returned plan.
 */
export async function planNostromoRestore(): Promise<NostromoRestorePlan> {
  const config = requireConfig()
  let documents: NostromoDocument[]

  try {
    documents = await listAllRemoteDocuments(config)
  } catch (error) {
    const failure = toClientError(error, 'Le listage des documents distants a échoué.')
    pushNostromoLog('error', `Restauration Nostromo : ${failure.message}`)
    setNostromoSyncStatus(isAuthError(failure) ? 'auth-required' : 'error')
    throw failure
  }

  const remote = groupRemoteDocuments(documents)
  for (const warning of remote.warnings) {
    pushNostromoLog('warn', `Restauration Nostromo : ${warning}`)
  }

  const baselines = getAllBaselines()
  const localPhotos = await listLocalPhotos()
  for (const warning of localPhotos.warnings) {
    pushNostromoLog('warn', `Restauration Nostromo : ${warning}`)
  }
  const collectionUnits = NOSTROMO_PLAN_ORDER.map((unit) => buildCollectionPlanUnit(unit, remote, baselines))
  const photoUnits = buildPhotoPlanUnits(remote, baselines, localPhotos.ids)
  const units = [...collectionUnits, ...photoUnits]

  const plan: NostromoRestorePlan = {
    collectionUnits,
    fetchedAt: Date.now(),
    localPhotoCount: localPhotos.ids.size,
    photoUnits,
    remoteDocumentCount: documents.length,
    remotePhotoCount: remote.photos.size,
    requiresConfirmation: units.some((unit) => unit.requiresConfirmation),
    warnings: [
      ...remote.warnings,
      ...localPhotos.warnings,
      ...units.flatMap((unit) => unit.warnings.map((warning) => `${unit.unit}: ${warning}`)),
    ],
  }

  pushNostromoLog(
    'info',
    `Restauration Nostromo : plan lu (${collectionUnits.length} collections, ${photoUnits.length} photos, ${plan.warnings.length} avertissements).`
  )
  return plan
}

/** Sorts the listed documents into collection and photo units, ignoring the rest. */
function groupRemoteDocuments(documents: NostromoDocument[]): RemoteGroups {
  const groups: RemoteGroups = { collections: new Map(), photos: new Map(), warnings: [] }

  for (const document of documents) {
    const payload = toPayloadRecord(document.payload)
    if (!payload) {
      groups.warnings.push(`le document distant ${document.id} ne porte aucune charge utile lisible, il est ignoré.`)
      continue
    }
    if (payload.type === 'photo') {
      const read = readPhotoPayload(document.payload)
      if (read.kind === 'invalid') {
        groups.warnings.push(
          `le document distant ${document.id} n'est pas une charge utile de photo (${read.reason}), il est ignoré.`
        )
        continue
      }
      keepNewestDocument(groups.photos, read.playerId, document, `la photo du joueur ${read.playerId}`, groups.warnings)
      continue
    }
    if (payload.type === 'collection' && isCollectionUnitName(payload.name)) {
      keepNewestDocument(groups.collections, payload.name, document, `la collection ${payload.name}`, groups.warnings)
      continue
    }
    groups.warnings.push(`le document distant ${document.id} porte une charge utile inconnue, il est ignoré.`)
  }

  return groups
}

/** Keeps the newest of two documents claiming the same unit, and says so. */
function keepNewestDocument(
  map: Map<string, NostromoDocument>,
  key: string,
  document: NostromoDocument,
  label: string,
  warnings: string[]
): void {
  const current = map.get(key)
  if (!current) {
    map.set(key, document)
    return
  }
  const newest = document.version > current.version ? document : current
  map.set(key, newest)
  warnings.push(`plusieurs documents distants revendiquent ${label}, la version ${newest.version} est conservée.`)
}

/** Builds the plan entry of one collection unit: what the server holds versus what is stored locally. */
function buildCollectionPlanUnit(
  unit: NostromoUnitName,
  remote: RemoteGroups,
  baselines: NostromoBaselines
): NostromoCollectionPlanUnit {
  const localBaseline = baselines[unit]
  const localCount = countCollectionItems(unit)
  const localDirty = isUnitDirty(unit)
  const document = remote.collections.get(unit)
  const warnings: string[] = []
  let remotePayloadValid = false
  let remoteSummary: NostromoRemoteSummary | undefined
  let requiresConfirmation = false

  if (document) {
    const read = readCollectionPayload(document.payload, unit)
    remotePayloadValid = read.kind !== 'invalid'
    remoteSummary = {
      docId: document.id,
      itemCount: countPayloadItems(read),
      updated: document.updated,
      version: document.version,
    }

    if (remotePayloadValid) {
      if (localDirty) {
        warnings.push("des changements locaux sont en attente d'envoi, la restauration les abandonne.")
        requiresConfirmation = true
      }
      if (localBaseline && document.version > localBaseline.version) {
        warnings.push(
          `la copie du serveur est plus récente que la référence locale (version distante ${document.version}, référence ${localBaseline.version}), la restauration écrase les données locales.`
        )
        requiresConfirmation = true
      }
      if (!localBaseline && localCount > 0) {
        warnings.push(
          `aucune référence locale n'est connue pour cette collection alors que ${localCount} élément(s) sont stockés localement, la restauration les écrase.`
        )
        requiresConfirmation = true
      }
    } else {
      warnings.push("la charge utile distante n'est pas une collection lisible, la restauration ignore cet élément.")
    }
  } else if (localBaseline) {
    warnings.push("le serveur ne détient plus de document pour cette collection, il n'y a rien à restaurer.")
  }

  return {
    kind: 'collection',
    localBaseline,
    localCount,
    localDirty,
    remote: remoteSummary,
    remotePayloadValid,
    requiresConfirmation,
    unit,
    warnings,
  }
}

/** Number of entries a readable payload describes; absent when the payload was refused. */
function countPayloadItems(read: CollectionPayloadRead): number | undefined {
  if (read.kind === 'invalid') {
    return undefined
  }
  if (read.kind === 'titles') {
    return read.titles.teamName === '' ? 0 : 1
  }
  return read.items.length
}

/** Builds one plan entry per photo unit: every remote photo, plus every local photo the server does not know. */
function buildPhotoPlanUnits(
  remote: RemoteGroups,
  baselines: NostromoBaselines,
  localPhotoIds: ReadonlySet<string>
): NostromoPhotoPlanUnit[] {
  const playerIds = new Set([...remote.photos.keys(), ...localPhotoIds])
  return [...playerIds].sort().map((playerId) => buildPhotoPlanUnit(playerId, remote, baselines, localPhotoIds))
}

function buildPhotoPlanUnit(
  playerId: string,
  remote: RemoteGroups,
  baselines: NostromoBaselines,
  localPhotoIds: ReadonlySet<string>
): NostromoPhotoPlanUnit {
  const unit = photoUnitName(playerId)
  const localBaseline = baselines[unit]
  const localDirty = isUnitDirty(unit)
  const localPhotoExists = localPhotoIds.has(playerId)
  const document = remote.photos.get(playerId)
  const warnings: string[] = []
  let deletionRequired = false
  let remoteSummary: NostromoRemoteSummary | undefined
  let requiresConfirmation = false
  let upToDate = false

  if (document) {
    remoteSummary = {
      docId: document.id,
      file: document.file,
      updated: document.updated,
      version: document.version,
    }
    if (!document.file) {
      warnings.push('le document distant ne porte aucun fichier, la restauration ignore cette photo.')
    }
    upToDate =
      Boolean(document.file) &&
      localPhotoExists &&
      !localDirty &&
      localBaseline?.docId === document.id &&
      localBaseline.version === document.version

    if (!upToDate && localPhotoExists) {
      if (localDirty) {
        warnings.push("une modification locale de cette photo est en attente d'envoi, la restauration l'abandonne.")
        requiresConfirmation = true
      }
      if (localBaseline && document.version > localBaseline.version) {
        warnings.push(
          `la copie du serveur est plus récente que la référence locale (version distante ${document.version}, référence ${localBaseline.version}), la restauration écrase la photo locale.`
        )
        requiresConfirmation = true
      }
      if (!localBaseline) {
        warnings.push(
          "aucune référence locale n'est connue pour cette photo alors qu'une copie locale existe, la restauration l'écrase."
        )
        requiresConfirmation = true
      }
    }
  } else if (localPhotoExists) {
    deletionRequired = true
    requiresConfirmation = true
    warnings.push('le serveur ne détient aucune copie de cette photo, la restauration la supprime localement.')
  }

  return {
    deletionRequired,
    kind: 'photo',
    localBaseline,
    localDirty,
    localPhotoExists,
    playerId,
    remote: remoteSummary,
    requiresConfirmation,
    unit,
    upToDate,
    warnings,
  }
}

/**
 * Player ids of the photos held locally, plus what the read has to say about them:
 * the ids of the local photos, and the warning to show when the enumeration was
 * abandoned.
 */
interface LocalPhotoListing {
  ids: Set<string>
  /** Empty when the store answered; the reason the local photos are ignored otherwise. */
  warnings: string[]
}

/**
 * Reads the ids of the photos held locally, under
 * `NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS`. A store that never answers would leave
 * `planNostromoRestore()` pending forever, with the whole sync card busy on a
 * promise that cannot settle: past the bound the enumeration degrades to an empty
 * list and says so. The plan then proposes neither to delete nor to push a photo,
 * which is the conservative direction, and the next plan reads the store again.
 */
async function listLocalPhotos(): Promise<LocalPhotoListing> {
  const entries = await readLocalPhotoEntries()
  if (!entries) {
    return { ids: new Set(), warnings: [LOCAL_PHOTO_READ_TIMEOUT_WARNING] }
  }
  return { ids: new Set(entries.map((entry) => entry.playerId)), warnings: [] }
}

/** Photo entries held locally, or `undefined` when the store did not answer in time. */
async function readLocalPhotoEntries(): Promise<PhotoEntry[] | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined)
    }, NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS)
  })

  try {
    return await Promise.race([getAllPhotoEntries(), bound])
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

/** Reads the configuration, or refuses the run: without it no call can be made. */
export function requireConfig(): NostromoConfig {
  const config = getConfig()
  if (!config) {
    throw new NostromoClientError("Nostromo n'est pas configuré : connectez-vous avant de restaurer.", { kind: 'auth' })
  }
  return config
}

/** True when the failure is a refused session, the only failure a run does not absorb. */
export function isAuthError(error: unknown): error is NostromoClientError {
  return error instanceof NostromoClientError && error.kind === 'auth'
}

/** Returns the failure as a `NostromoClientError`, wrapping anything the client did not raise. */
function toClientError(error: unknown, message: string): NostromoClientError {
  if (error instanceof NostromoClientError) {
    return error
  }
  return new NostromoClientError(message, { cause: error, kind: 'unknown' })
}
