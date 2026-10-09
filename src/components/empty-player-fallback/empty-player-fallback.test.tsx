import { describe, expect, it } from 'vitest'
import { renderView } from '../test-utils'
import BsEmptyPlayerFallback from './empty-player-fallback'

describe('BsEmptyPlayerFallback', () => {
  it('shows the French empty-roster message inside a heading', () => {
    // Guards empty-player-fallback.tsx:8 (message text) and :6 (heading wrapper)
    const { container } = renderView(() => <BsEmptyPlayerFallback />)

    expect(container.querySelector('h4 span')?.textContent).toBe('Aucun joueur enregistré.')
  })

  it('renders the warning icon before the message', () => {
    // Guards empty-player-fallback.tsx:7 (icon precedes text)
    const { container } = renderView(() => <BsEmptyPlayerFallback />)

    const heading = container.querySelector('h4')
    expect(heading?.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(heading?.lastElementChild?.tagName.toLowerCase()).toBe('span')
  })
})
