import { describe, expect, it } from 'vitest'

const RGB_COLOUR_PATTERN = /^rgb\(\d+, \d+, \d+\)$/

import { renderView } from '../test-utils'
import BsAvatar from './avatar'

describe('BsAvatar', () => {
  it('shows the uppercased first letter of the display name when there is no photo', () => {
    // Guards avatar.tsx:24 (initial is first char, uppercased)
    const { container } = renderView(() => <BsAvatar displayName="marie" hasPhoto={false} playerId="p1" />)

    expect(container.textContent).toBe('M')
  })

  it('shows ? when the display name is empty', () => {
    // Guards avatar.tsx:24 (fallback '?' when displayName is empty)
    const { container } = renderView(() => <BsAvatar displayName="" hasPhoto={false} playerId="p1" />)

    expect(container.textContent).toBe('?')
  })

  it('defaults to 64px and derives font-size from the size prop', () => {
    // Guards avatar.tsx:23 (default size 64) and :34-36 (size-driven inline style)
    const defaults = renderView(() => <BsAvatar displayName="A" hasPhoto={false} playerId="p1" />)
    const large = renderView(() => <BsAvatar displayName="A" hasPhoto={false} playerId="p1" size={100} />)

    const defaultBadge = defaults.container.firstElementChild as HTMLElement
    const largeBadge = large.container.firstElementChild as HTMLElement
    expect(defaultBadge.style.width).toBe('64px')
    expect(defaultBadge.style.fontSize).toBe('25.6px')
    expect(largeBadge.style.width).toBe('100px')
    expect(largeBadge.style.fontSize).toBe('40px')
  })

  it('derives a stable hue from the player id and changes it for a different id', () => {
    // Guards avatar.tsx:6-12 and :25 (hue hash drives background colour)
    const first = renderView(() => <BsAvatar displayName="A" hasPhoto={false} playerId="p1" />)
    const again = renderView(() => <BsAvatar displayName="A" hasPhoto={false} playerId="p1" />)
    const other = renderView(() => <BsAvatar displayName="A" hasPhoto={false} playerId="player-zeta" />)

    const colour = (el: HTMLElement | null | undefined) => el?.style.backgroundColor
    const firstColour = colour(first.container.firstElementChild as HTMLElement)
    // jsdom serialises hsl() as rgb(), so only the colour format and stability are asserted here.
    expect(firstColour).toMatch(RGB_COLOUR_PATTERN)
    expect(colour(again.container.firstElementChild as HTMLElement)).toBe(firstColour)
    expect(colour(other.container.firstElementChild as HTMLElement)).not.toBe(firstColour)
  })
})
