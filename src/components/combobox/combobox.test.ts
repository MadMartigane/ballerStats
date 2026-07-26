import { describe, expect, it } from 'vitest'
import { canCreateOption, filterOptions } from './combobox'

describe('filterOptions', () => {
  it('returns all options when query is empty', () => {
    const options = ['Alpha', 'Beta', 'Gamma']
    expect(filterOptions(options, '')).toEqual(options)
  })

  it('returns all options when query is whitespace only', () => {
    const options = ['Alpha', 'Beta']
    expect(filterOptions(options, '   ')).toEqual(options)
  })

  it('filters case-insensitive substring match', () => {
    const options = ['Alpha', 'Beta', 'ALPHA']
    expect(filterOptions(options, 'alp')).toEqual(['Alpha', 'ALPHA'])
  })

  it('returns empty array when no match', () => {
    const options = ['Alpha', 'Beta']
    expect(filterOptions(options, 'xyz')).toEqual([])
  })

  it('preserves original option order', () => {
    const options = ['gamma', 'alpha', 'beta']
    expect(filterOptions(options, 'a')).toEqual(['gamma', 'alpha', 'beta']) // both alpha and gamma contain 'a'
  })

  it('does not mutate the input array', () => {
    const options = ['Alpha', 'Beta']
    const copy = [...options]
    filterOptions(options, 'alp')
    expect(options).toEqual(copy)
  })
})

describe('canCreateOption', () => {
  it('returns false for empty query', () => {
    expect(canCreateOption(['Alpha'], '')).toBe(false)
  })

  it('returns false for whitespace-only query', () => {
    expect(canCreateOption(['Alpha'], '   ')).toBe(false)
  })

  it('returns false when exact match exists (case-insensitive)', () => {
    expect(canCreateOption(['Alpha'], 'alpha')).toBe(false)
    expect(canCreateOption(['alpha'], 'Alpha')).toBe(false)
  })

  it('returns true for new label not in options', () => {
    expect(canCreateOption(['Alpha'], 'Beta')).toBe(true)
  })

  it('returns true when options is empty and query non-empty', () => {
    expect(canCreateOption([], 'New')).toBe(true)
  })
})
