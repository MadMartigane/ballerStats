import { describe, expect, it } from 'vitest'
import { formatQualityBadge, resolveGaugeDomain, toGaugePercentage } from './play-time-gauge'

describe('resolveGaugeDomain', () => {
  it('uses the theoretical total when both sums sit below it', () => {
    expect(resolveGaugeDomain(160, 100, 120)).toBe(160)
  })

  it('grows to the largest source sum when it overflows the theoretical total', () => {
    expect(resolveGaugeDomain(160, 100, 163.49)).toBe(163.49)
    expect(resolveGaugeDomain(160, 200, 120)).toBe(200)
  })

  it('never returns a zero domain', () => {
    expect(resolveGaugeDomain(0, 0, 0)).toBe(1)
  })
})

describe('toGaugePercentage', () => {
  it('converts a value to a percentage of the domain', () => {
    expect(toGaugePercentage(80, 160)).toBe(50)
    expect(toGaugePercentage(160, 160)).toBe(100)
  })

  it('reports the theoretical tick at 97.9% when the events sum overflows', () => {
    expect(toGaugePercentage(160, 163.49)).toBeCloseTo(97.86, 1)
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
