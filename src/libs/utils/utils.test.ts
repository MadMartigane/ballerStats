import { describe, expect, it } from 'vitest'
import { getUniqId } from './utils'

const ID_CHARSET = /^[a-z0-9]+$/

describe('getUniqId', () => {
  it('returns a 15-character id', () => {
    expect(getUniqId()).toHaveLength(15)
  })

  it('uses only [a-z0-9] characters', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(getUniqId()).toMatch(ID_CHARSET)
    }
  })

  it('generates unique ids over a large sample', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 10_000; i += 1) {
      ids.add(getUniqId())
    }
    expect(ids.size).toBe(10_000)
  })
})
