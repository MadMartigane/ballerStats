import { describe, expect, it } from 'vitest'
import { getUniqueChampionships, groupMatchesByChampionship, NO_CHAMPIONSHIP_LABEL } from './championship-util'
import Match from './match'

function makeMatch(championship: string | null, date?: string): Match {
  return new Match({
    championship,
    date: date ?? '2025-01-01',
    opponent: 'Test',
  })
}

describe('getUniqueChampionships', () => {
  it('returns empty array for empty match list', () => {
    expect(getUniqueChampionships([])).toEqual([])
  })

  it('returns unique sorted labels', () => {
    const matches = [makeMatch('Beta'), makeMatch('Alpha'), makeMatch('Beta'), makeMatch('Gamma')]
    expect(getUniqueChampionships(matches)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('excludes null championship', () => {
    const matches = [makeMatch('Alpha'), makeMatch(null)]
    expect(getUniqueChampionships(matches)).toEqual(['Alpha'])
  })

  it('excludes empty string championship', () => {
    const matches = [makeMatch(''), makeMatch('Alpha')]
    expect(getUniqueChampionships(matches)).toEqual(['Alpha'])
  })

  it('case-sensitive deduplication (Coupe and coupe are distinct)', () => {
    const matches = [makeMatch('Coupe'), makeMatch('coupe')]
    const championships = getUniqueChampionships(matches)
    expect(championships).toHaveLength(2)
    expect(championships).toEqual(expect.arrayContaining(['Coupe', 'coupe']))
  })

  it('sorts alphabetically', () => {
    const matches = [makeMatch('Zeta'), makeMatch('Alpha'), makeMatch('Beta')]
    expect(getUniqueChampionships(matches)).toEqual(['Alpha', 'Beta', 'Zeta'])
  })
})

describe('groupMatchesByChampionship', () => {
  it('returns empty array for empty match list', () => {
    expect(groupMatchesByChampionship([])).toEqual([])
  })

  it('groups matches by championship', () => {
    const m1 = makeMatch('A', '2025-01-01')
    const m2 = makeMatch('B', '2025-02-01')
    const m3 = makeMatch('A', '2025-03-01')
    const groups = groupMatchesByChampionship([m1, m2, m3])
    expect(groups).toHaveLength(2)
    expect(groups[0].name).toBe('A')
    expect(groups[0].matchs).toHaveLength(2)
    expect(groups[1].name).toBe('B')
    expect(groups[1].matchs).toHaveLength(1)
  })

  it('sorts matches chronologically ascending within group (oldest first)', () => {
    const m1 = makeMatch('A', '2025-03-01')
    const m2 = makeMatch('A', '2025-01-01')
    const m3 = makeMatch('A', '2025-02-01')
    const groups = groupMatchesByChampionship([m1, m2, m3])
    expect(groups).toHaveLength(1)
    const dates = groups[0].matchs.map((match) => match.date)
    expect(dates).toEqual(['2025-01-01', '2025-02-01', '2025-03-01'])
  })

  it('null championship grouped under NO_CHAMPIONSHIP_LABEL', () => {
    const m1 = makeMatch(null, '2025-01-01')
    const groups = groupMatchesByChampionship([m1])
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe(NO_CHAMPIONSHIP_LABEL)
  })

  it('empty string championship grouped under NO_CHAMPIONSHIP_LABEL', () => {
    const m1 = makeMatch('', '2025-01-01')
    const groups = groupMatchesByChampionship([m1])
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe(NO_CHAMPIONSHIP_LABEL)
  })

  it('NO_CHAMPIONSHIP_LABEL group is always last', () => {
    const m1 = makeMatch('Zeta', '2025-01-01')
    const m2 = makeMatch(null, '2025-02-01')
    const m3 = makeMatch('Alpha', '2025-03-01')
    const groups = groupMatchesByChampionship([m1, m2, m3])
    expect(groups).toHaveLength(3)
    expect(groups[0].name).toBe('Alpha')
    expect(groups[1].name).toBe('Zeta')
    expect(groups[2].name).toBe(NO_CHAMPIONSHIP_LABEL)
  })

  it('groups alphabetically with NO_CHAMPIONSHIP_LABEL last', () => {
    const m1 = makeMatch('C', '2025-01-01')
    const m2 = makeMatch('A', '2025-01-01')
    const m3 = makeMatch('B', '2025-01-01')
    const groups = groupMatchesByChampionship([m1, m2, m3])
    expect(groups.map((group) => group.name)).toEqual(['A', 'B', 'C'])
  })

  it('matches with no date sort after matches with dates', () => {
    const m1 = makeMatch('A', '2025-01-01')
    const m2 = new Match({ championship: 'A', opponent: 'Test' })
    const groups = groupMatchesByChampionship([m1, m2])
    expect(groups).toHaveLength(1)
    expect(groups[0].matchs[0].date).toBe('2025-01-01')
    expect(groups[0].matchs[1].date).toBeNull()
  })
})
