import { describe, expect, it } from 'vitest'
import { formatGapLabel, formatMinutes, formatQualityBadge, resolveQualityStatus } from './play-time-gauge'

describe('resolveQualityStatus', () => {
  it('labels a quality of 80 percent or more as Fiable with the success tone', () => {
    expect(resolveQualityStatus(1)).toEqual({ label: 'Fiable', tone: 'success' })
    expect(resolveQualityStatus(0.8)).toEqual({ label: 'Fiable', tone: 'success' })
    expect(resolveQualityStatus(0.81)).toEqual({ label: 'Fiable', tone: 'success' })
  })

  it('labels a quality between 50 and 80 percent as Acceptable with the warning tone', () => {
    expect(resolveQualityStatus(0.79)).toEqual({ label: 'Acceptable', tone: 'warning' })
    expect(resolveQualityStatus(0.5)).toEqual({ label: 'Acceptable', tone: 'warning' })
  })

  it('labels a quality below 50 percent as Fragile with the error tone', () => {
    expect(resolveQualityStatus(0.49)).toEqual({ label: 'Fragile', tone: 'error' })
    expect(resolveQualityStatus(0)).toEqual({ label: 'Fragile', tone: 'error' })
  })

  it('reports a neutral Non calculée status when no percentage exists', () => {
    expect(resolveQualityStatus(null)).toEqual({ label: 'Non calculée', tone: 'neutral' })
  })
})

describe('formatGapLabel', () => {
  it('renders a rounded whole gap percentage', () => {
    expect(formatGapLabel(0.0351)).toBe('4 %')
    expect(formatGapLabel(0.25)).toBe('25 %')
  })

  it('renders the dash when no gap exists', () => {
    expect(formatGapLabel(null)).toBe('—')
  })
})

describe('formatMinutes', () => {
  it('rounds minutes to a whole number with a min suffix', () => {
    expect(formatMinutes(163.49)).toBe('163 min')
    expect(formatMinutes(160)).toBe('160 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})

describe('formatQualityBadge', () => {
  it('renders a rounded whole percentage', () => {
    expect(formatQualityBadge(1)).toBe('100 %')
    expect(formatQualityBadge(0.5)).toBe('50 %')
    expect(formatQualityBadge(0)).toBe('0 %')
  })

  it('renders the dash when no percentage exists', () => {
    expect(formatQualityBadge(null)).toBe('—')
  })
})
