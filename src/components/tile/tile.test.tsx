import { describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsTile from './tile'

const noopClick = (): void => undefined

describe('BsTile', () => {
  it('renders the title as a heading with a title attribute when it is a string', () => {
    // Guards tile.tsx:45 (title attribute only for string titles)
    const { container } = renderView(() => <BsTile title="Équipe A" />)

    const heading = container.querySelector('h2')
    expect(heading?.textContent).toBe('Équipe A')
    expect(heading?.getAttribute('title')).toBe('Équipe A')
  })

  it('omits the title attribute when the title is an element', () => {
    // Guards tile.tsx:45 (typeof check; a JSX title must not produce title="[object Object]")
    const { container } = renderView(() => <BsTile title={<span>Score</span>} />)

    const heading = container.querySelector('h2')
    expect(heading?.textContent).toBe('Score')
    expect(heading?.hasAttribute('title')).toBe(false)
  })

  it('renders no heading when no title is given', () => {
    // Guards tile.tsx:42-49 (Show when props.title)
    const { container } = renderView(() => <BsTile body={<span>Corps</span>} />)

    expect(container.querySelector('h2')).toBeNull()
    expect(container.textContent).toContain('Corps')
  })

  it('shows the pointer cursor only when an onClick handler is provided', () => {
    // Guards tile.tsx:30 (cursor-pointer class toggled by props.onClick)
    const clickable = renderView(() => <BsTile onClick={noopClick} />)
    const passive = renderView(() => <BsTile />)

    expect((clickable.container.firstElementChild as HTMLElement).className).toContain('cursor-pointer')
    expect((passive.container.firstElementChild as HTMLElement).className).not.toContain('cursor-pointer')
  })

  it('calls onClick when the tile is clicked', () => {
    // Guards tile.tsx:31 and tile.tsx:13 (click wiring to props.onClick)
    const onClick = vi.fn()
    const { container } = renderView(() => <BsTile onClick={onClick} title="Cliquable" />)

    ;(container.firstElementChild as HTMLElement).click()

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick when Enter is pressed on the tile', () => {
    // Guards tile.tsx:19 (keydown Enter activation; KeyboardEvent.key is 'Enter', never lowercase)
    const onClick = vi.fn()
    const { container } = renderView(() => <BsTile onClick={onClick} title="Clavier" />)

    const enterEvent = new KeyboardEvent('keydown', { bubbles: true, code: 'Enter', key: 'Enter' })
    container.firstElementChild?.dispatchEvent(enterEvent)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders footer content inside card-actions only when a footer is given', () => {
    // Guards tile.tsx:71-74 (footer Show and card-actions wrapper)
    const withFooter = renderView(() => <BsTile footer={<button type="button">Valider</button>} />)
    const withoutFooter = renderView(() => <BsTile />)

    expect(withFooter.container.querySelector('.card-actions')?.textContent).toBe('Valider')
    expect(withoutFooter.container.querySelector('.card-actions')).toBeNull()
  })

  it('renders info text inside the italic paragraph', () => {
    // Guards tile.tsx:56-60 (info Show, italic wrapper, span content)
    const { container } = renderView(() => <BsTile info="Dernier match il y a 2 jours" />)

    const paragraph = container.querySelector('p.italic')
    expect(paragraph?.querySelector('span')?.textContent).toBe('Dernier match il y a 2 jours')
  })
})
