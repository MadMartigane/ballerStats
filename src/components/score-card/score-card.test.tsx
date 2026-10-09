import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderView } from '../test-utils'
import BsScoreCard from './score-card'

const ROLL_SETTLE_MS = 600

function scoreCell(container: HTMLElement, index: number): string | null | undefined {
  return container.querySelectorAll('span.font-mono')[index]?.textContent
}

describe('BsScoreCard', () => {
  it('shows both scores immediately on first render', () => {
    // Guards score-card.tsx:8-9 and :14/:28 (createRollingNumber initial value)
    const { container } = renderView(() => <BsScoreCard localScore={12} visitorScore={7} />)

    expect(scoreCell(container, 0)).toBe('12')
    expect(scoreCell(container, 1)).toBe('7')
  })

  it('falls back to LOCAL and VISITEUR when team names are missing', () => {
    // Guards score-card.tsx:32 and :40 (name fallbacks)
    const { container } = renderView(() => <BsScoreCard localScore={0} visitorScore={0} />)

    expect(container.textContent).toContain('LOCAL')
    expect(container.textContent).toContain('VISITEUR')
  })

  it('renders the given team names instead of the fallbacks', () => {
    // Guards score-card.tsx:32 and :40 (names replace fallbacks when present)
    const { container } = renderView(() => (
      <BsScoreCard localName="Baller" localScore={0} visitorName="Rivals" visitorScore={0} />
    ))

    expect(container.textContent).toContain('Baller')
    expect(container.textContent).toContain('Rivals')
    expect(container.textContent).not.toContain('LOCAL')
    expect(container.textContent).not.toContain('VISITEUR')
  })

  it('shows the home badge only when a location is given', () => {
    // Guards score-card.tsx:18-22 (location Show and BsMatchTypeBadge)
    const withLocation = renderView(() => <BsScoreCard localScore={0} location="home" visitorScore={0} />)
    const withoutLocation = renderView(() => <BsScoreCard localScore={0} visitorScore={0} />)

    expect(withLocation.container.querySelector('.badge')?.textContent).toBe('↗ Domicile')
    expect(withoutLocation.container.querySelector('.badge')).toBeNull()
  })

  it('formats the match date as French date and time without seconds', () => {
    // Guards score-card.tsx:23-24 (toDateTime rendering when date is given)
    const { container } = renderView(() => <BsScoreCard date="2026-03-10T14:30:00" localScore={0} visitorScore={0} />)

    expect(container.textContent).toContain('10/03/2026 - 14:30')
  })

  it('rolls the displayed score to a new value when the reactive prop changes', async () => {
    // Guards score-card.tsx:8 (score source is a reactive getter, so prop changes reach the display)
    const [local, setLocal] = createSignal(0)
    const { container } = renderView(() => <BsScoreCard localScore={local()} visitorScore={0} />)
    expect(scoreCell(container, 0)).toBe('0')

    setLocal(3)
    await new Promise((resolve) => setTimeout(resolve, ROLL_SETTLE_MS))
    expect(scoreCell(container, 0)).toBe('3')
  })
})
