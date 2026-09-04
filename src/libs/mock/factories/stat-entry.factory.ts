import type { MatchStatLogEntry } from '../../match/match.d'
import type { StatMatchActionItemName, StatMatchActionItemType } from '../../stats/stats.d'
import { STAT_ACTION_DEFAULTS } from '../../stats/stats-action-values'

// Build a type-safe lookup map from the canonical action defaults
const STAT_DEFAULTS = new Map<string, number>(
  STAT_ACTION_DEFAULTS.map((e) => [`${e.name}:${e.type}`, e.value] as const)
)

export const MOCK_BASE_TIMESTAMP = 1_700_000_000_000

export type MakeStatEntryOverrides = Partial<Omit<MatchStatLogEntry, 'name'>>

/** Build a single MatchStatLogEntry (plain data). */
export function makeStatEntry(
  name: StatMatchActionItemName,
  overrides: MakeStatEntryOverrides = {}
): MatchStatLogEntry {
  const type: StatMatchActionItemType = overrides.type ?? 'success'
  const key = `${name}:${type}`
  const fallback = STAT_DEFAULTS.get(key)
  if (fallback === undefined && overrides.value === undefined) {
    throw new Error(`[makeStatEntry] no canonical default for "${key}"`)
  }
  const value = (overrides.value ?? fallback) as number
  return {
    name,
    playerId: overrides.playerId ?? null,
    timestamp: overrides.timestamp ?? MOCK_BASE_TIMESTAMP,
    type,
    value,
  }
}
