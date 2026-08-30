import { render } from 'solid-js/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BsLeaseBanner from './lease-banner'
import type { BsLeaseBannerProps } from './lease-banner.d'

let disposeCurrent: (() => void) | undefined

function mount(props: BsLeaseBannerProps): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  disposeCurrent = render(
    () => (
      <BsLeaseBanner holderName={props.holderName} onForce={props.onForce} showForceButton={props.showForceButton} />
    ),
    container
  )
  return container
}

afterEach(() => {
  disposeCurrent?.()
  disposeCurrent = undefined
  document.body.innerHTML = ''
})

describe('BsLeaseBanner', () => {
  it('shows the holder name in the banner', () => {
    const container = mount({ holderName: 'Alice', onForce: () => undefined, showForceButton: false })
    expect(container.textContent).toContain('Saisie en cours par')
    expect(container.textContent).toContain('Alice')
  })

  it('falls back to a generic label when the holder name is unknown', () => {
    const container = mount({ holderName: null, onForce: () => undefined, showForceButton: false })
    expect(container.textContent).toContain('un autre utilisateur')
  })

  it('renders the force button only when allowed (manager)', () => {
    const container = mount({ holderName: 'Alice', onForce: () => undefined, showForceButton: true })
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button?.textContent).toContain('Prendre la main')
  })

  it('hides the force button for non-managers', () => {
    const container = mount({ holderName: 'Alice', onForce: () => undefined, showForceButton: false })
    expect(container.querySelector('button')).toBeNull()
  })

  it('triggers onForce when the force button is clicked', () => {
    const onForce = vi.fn()
    const container = mount({ holderName: 'Alice', onForce, showForceButton: true })
    container.querySelector('button')?.click()
    expect(onForce).toHaveBeenCalledTimes(1)
  })
})
