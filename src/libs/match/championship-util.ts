import type Match from './match'

/** Display label for matches with no championship (null/undefined/empty). */
export const NO_CHAMPIONSHIP_LABEL = 'Sans championnat'

/**
 * Unique, alphabetically-sorted championship labels present in the given matches.
 * Excludes null/undefined/empty-string. Deterministic output for stable UI.
 */
export function getUniqueChampionships(matchs: Match[]): string[] {
  const set = new Set<string>()
  for (const match of matchs) {
    const label = match.championship
    if (label) {
      set.add(label)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Group matches by championship. Within each group, matches are sorted
 * chronologically ASCENDING (oldest first). Groups are ordered alphabetically,
 * with NO_CHAMPIONSHIP_LABEL always rendered LAST.
 */
export function groupMatchesByChampionship(matchs: Match[]): { name: string; matchs: Match[] }[] {
  const groups = new Map<string, Match[]>()
  for (const match of matchs) {
    const key = match.championship || NO_CHAMPIONSHIP_LABEL
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(match)
    } else {
      groups.set(key, [match])
    }
  }

  const toDate = (m: Match) => (m.date ? new Date(m.date).getTime() : Number.POSITIVE_INFINITY)
  for (const bucket of groups.values()) {
    // Sort each locally-constructed bucket chronologically (oldest first).
    bucket.sort((a, b) => toDate(a) - toDate(b))
  }

  return [...groups.keys()]
    .sort((a, b) => {
      if (a === NO_CHAMPIONSHIP_LABEL) {
        return 1
      }
      if (b === NO_CHAMPIONSHIP_LABEL) {
        return -1
      }
      return a.localeCompare(b)
    })
    .map((name) => ({ matchs: groups.get(name) ?? [], name }))
}
