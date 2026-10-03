import { describe, expect, it } from 'vitest'
import type { ResolvedMatchFormat } from '../../libs/team/match-format'
import { formatSourceLabel } from './match-format-line'

const resolved = (
  source: ResolvedMatchFormat['source'],
  config = { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }
): ResolvedMatchFormat => ({ ...config, source })

describe('formatSourceLabel', () => {
  it('labels a match-owned format', () => {
    expect(formatSourceLabel(resolved('match-override'))).toBe('Réglage du match')
  })

  it('labels the team default', () => {
    expect(formatSourceLabel(resolved('team-default'))).toBe('Format par défaut de l’équipe')
  })

  it('names the category on a category preset', () => {
    expect(formatSourceLabel(resolved('category-preset'), 'U13')).toBe('Préréglage de la catégorie U13')
  })

  it('stays generic on a category preset without a category', () => {
    expect(formatSourceLabel(resolved('category-preset'))).toBe('Préréglage de la catégorie d’âge')
    expect(formatSourceLabel(resolved('category-preset'), null)).toBe('Préréglage de la catégorie d’âge')
  })

  it('labels the bare fallback', () => {
    expect(formatSourceLabel(resolved('default'))).toBe('Format par défaut')
  })
})
