import { describe, expect, it } from 'vitest'
import { renderView } from '../test-utils'
import BsCard from './card'

describe('BsCard', () => {
  it('renders the title inside an h2 with the card-title class', () => {
    // Guards card.tsx:14-15 (title Show and heading)
    const { container } = renderView(() => <BsCard title={<span>Statistiques</span>} />)

    expect(container.querySelector('h2.card-title')?.textContent).toBe('Statistiques')
  })

  it('renders no title, info, body or footer when none are given', () => {
    // Guards card.tsx:14, :18, :25, :29 (every Show is gated on its prop)
    const { container } = renderView(() => <BsCard />)

    expect(container.querySelector('h2')).toBeNull()
    expect(container.querySelector('p')).toBeNull()
    expect(container.querySelector('hr')).toBeNull()
    expect(container.querySelector('.card-actions')).toBeNull()
  })

  it('renders the info paragraph with its icon and text', () => {
    // Guards card.tsx:18-22 (info Show, paragraph, text)
    const { container } = renderView(() => <BsCard info={<span>Mise à jour hier</span>} />)

    const paragraph = container.querySelector('p')
    expect(paragraph?.textContent).toBe('Mise à jour hier')
    expect(paragraph?.querySelector('svg')).not.toBeNull()
  })

  it('renders body content in its own wrapper', () => {
    // Guards card.tsx:25-27 (body Show and wrapper)
    const { container } = renderView(() => <BsCard body={<span>Contenu</span>} />)

    expect(container.querySelector('.card-body > div.my-4')?.textContent).toBe('Contenu')
  })

  it('renders a divider and footer actions only when a footer is given', () => {
    // Guards card.tsx:29-32 (footer Show, hr and card-actions wrapper)
    const withFooter = renderView(() => <BsCard footer={<button type="button">Fermer</button>} />)
    const withoutFooter = renderView(() => <BsCard />)

    expect(withFooter.container.querySelector('hr')).not.toBeNull()
    expect(withFooter.container.querySelector('.card-actions')?.textContent).toBe('Fermer')
    expect(withoutFooter.container.querySelector('.card-actions')).toBeNull()
  })
})
