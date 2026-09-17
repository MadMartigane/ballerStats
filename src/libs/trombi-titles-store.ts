import { createStore } from 'solid-js/store'

import { markCollectionDirty } from './nostromo/dirty-marks'
import { getStoredDataSync, STORAGE_TROMBI_TITLES_KEY, storeData } from './store/store'
import type { TrombiTitles } from './trombi-titles'

export const DEFAULT_TITLES: TrombiTitles = {
  teamName: '',
}

function loadInitialTitles(): TrombiTitles {
  const stored = getStoredDataSync<TrombiTitles>(STORAGE_TROMBI_TITLES_KEY)
  if (!stored?.data || typeof stored.data.teamName !== 'string') {
    return { ...DEFAULT_TITLES }
  }
  return stored.data
}

const [titles, setTitles] = createStore<TrombiTitles>(loadInitialTitles())

async function persistTitles(newTitles: TrombiTitles): Promise<void> {
  setTitles({ teamName: newTitles.teamName })
  await storeData(STORAGE_TROMBI_TITLES_KEY, newTitles)
  markCollectionDirty('trombiTitles')
}

export async function updateTitle<K extends keyof TrombiTitles>(field: K, value: TrombiTitles[K]): Promise<void> {
  const updated = { ...titles, [field]: value }
  await persistTitles(updated)
}

/**
 * Clone getter of the titles: the reactive getter of every other store. The
 * sync layer reads the titles through it, so it never holds a store proxy.
 */
export function getTitles(): TrombiTitles {
  return { teamName: titles.teamName }
}

export { persistTitles, titles }
