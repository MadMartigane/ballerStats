import type { JSX } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { renderView } from '../test-utils'
import BsIconBasketballBall from './basketball-ball'
import BsIconBasketballBallOutline from './basketball-ball-outline'
import BsIconBasketballBallPlain from './basketball-ball-plain'
import BsIconBasketballGoal from './basketball-goal'
import BsIconBasketballMissedGoal from './basketball-missed-goal'
import BsIconBasketballPanel from './basketball-panel'
import BsIconBasketballPlayer from './basketball-player'
import type { BsIconProps } from './icon-base.d'
import BsIconPersonPlay from './person-play'

const ICONS: Array<{ name: string; label: string; viewBox: string; Component: (props: BsIconProps) => JSX.Element }> = [
  {
    Component: BsIconBasketballBallOutline,
    label: 'Basketball ball outline',
    name: 'outline',
    viewBox: '0 -960 960 960',
  },
  { Component: BsIconBasketballBallPlain, label: 'Basketball ball', name: 'plain', viewBox: '0 0 512 512' },
  { Component: BsIconBasketballBall, label: 'Basketball ball', name: 'ball', viewBox: '0 0 77.832 77.832' },
  { Component: BsIconBasketballGoal, label: 'Basketball goal', name: 'goal', viewBox: '0 0 512 512' },
  { Component: BsIconBasketballMissedGoal, label: 'Missed goal', name: 'missed goal', viewBox: '0 0 64 64' },
  { Component: BsIconBasketballPanel, label: 'Basketball panel', name: 'panel', viewBox: '0 0 512 512' },
  { Component: BsIconBasketballPlayer, label: 'Basketball player', name: 'player', viewBox: '0 0 563.366 563.365' },
  { Component: BsIconPersonPlay, label: 'Person play', name: 'person play', viewBox: '0 -960 960 960' },
]

describe.each(ICONS)('Icon $name', ({ Component, label, viewBox }) => {
  it('renders an accessible svg with its label and viewBox', () => {
    // Guards icon-base.tsx:10,12,15 and the per-icon aria-label and viewBox props
    const { container } = renderView(() => <Component />)

    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe(label)
    expect(svg?.getAttribute('viewBox')).toBe(viewBox)
  })

  it('defaults to 24px and uses the size prop when given', () => {
    // Guards icon-base.tsx:3 (default 24) and :6 (size override)
    const defaults = renderView(() => <Component />)
    const large = renderView(() => <Component size={48} />)

    expect(defaults.container.querySelector('svg')?.getAttribute('width')).toBe('24')
    expect(defaults.container.querySelector('svg')?.getAttribute('height')).toBe('24')
    expect(large.container.querySelector('svg')?.getAttribute('width')).toBe('48')
    expect(large.container.querySelector('svg')?.getAttribute('height')).toBe('48')
  })

  it('forwards the class prop to the root svg', () => {
    // Guards icon-base.tsx:11 (class forwarded) and the {...props} spread in each icon
    const { container } = renderView(() => <Component class="h-6 text-primary" />)

    expect(container.querySelector('svg')?.getAttribute('class')).toBe('h-6 text-primary')
  })

  it('fills with currentColor so the icon follows text colour', () => {
    // Guards icon-base.tsx:12 (fill="currentColor")
    const { container } = renderView(() => <Component />)

    expect(container.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  })

  it('renders at least one drawable shape', () => {
    // Guards each icon's SVG path/g/circle/polygon children reaching the DOM
    const { container } = renderView(() => <Component />)

    expect(container.querySelector('svg')?.querySelector('path, circle, polygon')).not.toBeNull()
  })
})
