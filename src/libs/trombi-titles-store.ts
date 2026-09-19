import { createStore } from 'solid-js/store'

import { markCollectionDirty } from './nostromo/dirty-marks'
import { getStoredDataSync, STORAGE_TROMBI_TITLES_KEY, storeData } from './store/store'
import type { TrombiTitles } from './trombi-titles'
import { toast } from './utils/utils'

export const DEFAULT_TITLES: TrombiTitles = {
  teamName: '',
}

const LOCAL_SAVE_FAILURE_MESSAGE = 'Sauvegarde locale impossible : vos données ne seront pas synchronisées.'

function loadInitialTitles(): TrombiTitles {
  const stored = getStoredDataSync<TrombiTitles>(STORAGE_TROMBI_TITLES_KEY)
  if (!stored?.data || typeof stored.data.teamName !== 'string') {
    return { ...DEFAULT_TITLES }
  }
  return stored.data
}

const [titles, setTitles] = createStore<TrombiTitles>(loadInitialTitles())

function persistTitles(newTitles: TrombiTitles): void {
  setTitles({ teamName: newTitles.teamName })
  storeData(STORAGE_TROMBI_TITLES_KEY, newTitles).catch((error: unknown) => {
    console.error('storeData failed:', error)
    toast(LOCAL_SAVE_FAILURE_MESSAGE, 'error')
  })
  markCollectionDirty('trombiTitles')
}

export function updateTitle<K extends keyof TrombiTitles>(field: K, value: TrombiTitles[K]): void {
  persistTitles({ ...titles, [field]: value })
}

/**
 * Clone getter of the titles: the reactive getter of every other store. The
 * sync layer reads the titles through it, so it never holds a store proxy.
 */
export function getTitles(): TrombiTitles {
  return { teamName: titles.teamName }
}

export { persistTitles, titles }
