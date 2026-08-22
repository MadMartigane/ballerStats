import { describe, expect, it } from 'vitest'
import { GLOSSARY_COLUMNS, STAT_COLUMNS } from './stat-columns'

describe('stat-columns', () => {
  it('jersey is the only column without a glossary entry', () => {
    const columnsWithoutGlossary = STAT_COLUMNS.filter((col) => col.glossary === undefined)
    expect(columnsWithoutGlossary.map((c) => c.id).sort()).toEqual([
      '2pts',
      '3pts',
      'blocks',
      'fouls',
      'jersey',
      'name',
      'pts',
    ])
  })

  it('every glossary entry has a non-empty label and glossary data', () => {
    for (const column of GLOSSARY_COLUMNS) {
      expect(column.label.trim().length).toBeGreaterThan(0)
      expect(column.glossary.fullName.trim().length).toBeGreaterThan(0)
      if (column.glossary.explanation) {
        expect(column.glossary.explanation.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('every column has a unique id', () => {
    const ids = STAT_COLUMNS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('columns appear in the documented order', () => {
    expect(STAT_COLUMNS.map((c) => c.id)).toEqual([
      'jersey',
      'name',
      'pts',
      'rebounds',
      'fouls',
      'turnover',
      'assists',
      'steals',
      'free-throw',
      '2pts',
      '3pts',
      'blocks',
      'eff',
      'astTo',
      'tsPercent',
    ])
  })
})
