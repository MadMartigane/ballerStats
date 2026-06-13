import { createStore } from 'solid-js/store'

import { getStoredDataSync, STORAGE_TROMBI_TITLES_KEY, storeData } from './store'
import type { TrombiTitles } from './trombi-titles'

export const DEFAULT_TITLES: TrombiTitles = {
  clubName: '',
  teamName: '',
}

function loadInitialTitles(): TrombiTitles {
  const stored = getStoredDataSync<TrombiTitles>(STORAGE_TROMBI_TITLES_KEY)
  if (!stored?.data || typeof stored.data.clubName !== 'string' || typeof stored.data.teamName !== 'string') {
    return { ...DEFAULT_TITLES }
  }
  return stored.data
}

const [titles, setTitles] = createStore<TrombiTitles>(loadInitialTitles())

async function persistTitles(newTitles: TrombiTitles): Promise<void> {
  setTitles({ clubName: newTitles.clubName, teamName: newTitles.teamName })
  await storeData(STORAGE_TROMBI_TITLES_KEY, newTitles)
}

export async function updateTitle<K extends keyof TrombiTitles>(field: K, value: TrombiTitles[K]): Promise<void> {
  const updated = { ...titles, [field]: value }
  await persistTitles(updated)
}

export { persistTitles, titles }
