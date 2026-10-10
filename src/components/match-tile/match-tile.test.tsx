import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMatch } from '../../libs/mock/factories/match.factory'
import { makeStatEntry } from '../../libs/mock/factories/stat-entry.factory'
import { makeTeam } from '../../libs/mock/factories/team.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { getRawMatchs, hydrateMatchs } from '../../libs/stores/matchs-store'
import { hydrateTeams } from '../../libs/stores/teams-store'
import { renderView } from '../test-utils'
import BsMatchTile, { BsMatchTypeBadge, BsMatchTypeText } from './match-tile'

const TEAM_ID = 'team-tile-1'
const TEAM_NAME = 'Les Ballers'
const OPPONENT_NAME = 'Rivaux BC'

function seedTeam(playerCount = 2) {
  const team = makeTeam({
    id: TEAM_ID,
    name: TEAM_NAME,
    playerIds: Array.from({ length: playerCount }, (_, i) => `p${i}`),
  })
  hydrateTeams([team.getRawData()])
  return team
}

function winningMatch() {
  return makeMatch({
    championship: 'Coupe Test',
    date: '2026-03-14T18:30:00.000Z',
    opponent: OPPONENT_NAME,
    stats: [makeStatEntry('3pts', { playerId: 'p0' }), makeStatEntry('2pts', { playerId: 'OPPONENT' })],
    teamId: TEAM_ID,
  })
}

function lossingMatch() {
  return makeMatch({
    opponent: OPPONENT_NAME,
    stats: [makeStatEntry('2pts', { playerId: 'p0' }), makeStatEntry('3pts', { playerId: 'OPPONENT' })],
    teamId: TEAM_ID,
  })
}

function tieMatch() {
  return makeMatch({
    opponent: OPPONENT_NAME,
    stats: [makeStatEntry('2pts', { playerId: 'p0' }), makeStatEntry('2pts', { playerId: 'OPPONENT' })],
    teamId: TEAM_ID,
  })
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) {
    throw new Error(`Button "${label}" not found`)
  }
  return button
}

function stubDialog() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

function unstubDialog() {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
}

function clickDialogButton(className: 'btn-success' | 'btn-warning') {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog')
  const latest = dialogs.item(dialogs.length - 1)
  latest?.querySelector<HTMLButtonElement>(`button.${className}`)?.click()
}

async function flushMacrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('BsMatchTypeText', () => {
  it('shows the home label in success colour', () => {
    const { container } = renderView(() => <BsMatchTypeText type="home" />)

    const label = container.querySelector('span.text-success')
    expect(label?.textContent).toBe('↗ Domicile')
  })

  it('shows the away label in warning colour', () => {
    const { container } = renderView(() => <BsMatchTypeText type="outside" />)

    expect(container.querySelector('span.text-warning')?.textContent).toBe('↖ Extérieur')
  })

  it('renders nothing when no type is given', () => {
    const { container } = renderView(() => <BsMatchTypeText />)

    expect(container.textContent).toBe('')
  })

  it('applies the requested size class', () => {
    const { container } = renderView(() => <BsMatchTypeText size="lg" type="home" />)

    expect(container.querySelector('span.text-lg')).not.toBeNull()
  })
})

describe('BsMatchTypeBadge', () => {
  it('renders a success badge for home matches', () => {
    const { container } = renderView(() => <BsMatchTypeBadge type="home" />)

    const badge = container.querySelector('div.badge')
    expect(badge?.classList.contains('badge-success')).toBe(true)
    expect(badge?.textContent).toBe('↗ Domicile')
  })

  it('renders a warning badge for away matches', () => {
    const { container } = renderView(() => <BsMatchTypeBadge type="outside" />)

    const badge = container.querySelector('div.badge')
    expect(badge?.classList.contains('badge-warning')).toBe(true)
    expect(badge?.textContent).toBe('↖ Extérieur')
  })

  it('renders nothing when no type is given', () => {
    const { container } = renderView(() => <BsMatchTypeBadge />)

    expect(container.querySelector('div.badge')).toBeNull()
  })
})

describe('BsMatchTile', () => {
  beforeEach(() => {
    resetCounters()
    hydrateMatchs([])
    hydrateTeams([])
    stubDialog()
  })

  afterEach(() => {
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.remove()
    }
    unstubDialog()
    vi.restoreAllMocks()
  })

  it('shows the score line with team and opponent names when the match has stats', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={winningMatch()} />)

    const scoreLine = container.querySelector('div.text-lg')
    const spans = Array.from(scoreLine?.querySelectorAll('span') ?? []).map((span) => span.textContent)
    expect(spans).toEqual([TEAM_NAME, '3', '—', '2', OPPONENT_NAME])
  })

  it('colours the team score green on a win and shows the Victoire badge', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={winningMatch()} />)

    const teamScore = container.querySelector('span.font-mono')
    expect(teamScore?.classList.contains('text-success')).toBe(true)
    expect(container.textContent).toContain('Victoire')
    expect(container.querySelector('div.border-l-success')).not.toBeNull()
  })

  it('colours the team score red on a loss and shows the Défaite badge', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={lossingMatch()} />)

    const teamScore = container.querySelector('span.font-mono')
    expect(teamScore?.classList.contains('text-error')).toBe(true)
    expect(container.textContent).toContain('Défaite')
    expect(container.querySelector('div.border-l-error')).not.toBeNull()
  })

  it('shows no result badge and no border on a tie', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={tieMatch()} />)

    expect(container.textContent).not.toContain('Victoire')
    expect(container.textContent).not.toContain('Défaite')
    expect(container.querySelector('div.border-l-4')).toBeNull()
  })

  it('shows the team roster summary instead of the score when the match has no stats', () => {
    seedTeam(3)
    const { container } = renderView(() => <BsMatchTile match={makeMatch({ teamId: TEAM_ID })} />)

    expect(container.querySelector('p')?.textContent).toBe(`${TEAM_NAME} (3)`)
    expect(container.querySelector('span.font-mono')).toBeNull()
  })

  it('hides the roster summary when the match has stats', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={winningMatch()} />)

    expect(container.querySelector('p')).toBeNull()
  })

  it('shows the locked icon badge only for locked matches', () => {
    seedTeam()
    const locked = renderView(() => <BsMatchTile match={makeMatch({ status: 'locked', teamId: TEAM_ID })} />)
    const unlocked = renderView(() => <BsMatchTile match={makeMatch({ status: 'unlocked', teamId: TEAM_ID })} />)

    expect(locked.container.querySelector('div.badge-warning')).not.toBeNull()
    expect(unlocked.container.querySelector('div.badge-success.rounded-lg')).not.toBeNull()
    expect(unlocked.container.querySelector('div.badge-warning')).toBeNull()
  })

  it('shows the championship badge only when one is set', () => {
    seedTeam()
    const withChampionship = renderView(() => <BsMatchTile match={winningMatch()} />)
    const without = renderView(() => <BsMatchTile match={makeMatch({ teamId: TEAM_ID })} />)

    expect(withChampionship.container.textContent).toContain('Coupe Test')
    expect(without.container.textContent).not.toContain('Coupe Test')
  })

  it('renders the opponent as the title and the formatted date in the status row', () => {
    seedTeam()
    const { container } = renderView(() => <BsMatchTile match={winningMatch()} />)

    expect(container.querySelector('h2')?.textContent).toBe(OPPONENT_NAME)
    expect(container.textContent).toContain('14/03/2026')
  })

  it('calls onStart with the match when the tile body is clicked', () => {
    seedTeam()
    const match = winningMatch()
    const onStart = vi.fn()
    const { container } = renderView(() => <BsMatchTile match={match} onStart={onStart} />)

    container.querySelector<HTMLElement>('div.card')?.click()

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(match)
  })

  it('renders the edit button only when onEdit is provided and calls it without starting the match', () => {
    seedTeam()
    const match = winningMatch()
    const onEdit = vi.fn()
    const onStart = vi.fn()
    const withEdit = renderView(() => <BsMatchTile match={match} onEdit={onEdit} onStart={onStart} />)
    const withoutEdit = renderView(() => <BsMatchTile match={match} />)

    expect(withoutEdit.container.querySelector('button[aria-label="Modifier le match"]')).toBeNull()

    getButton(withEdit.container, 'Modifier le match').click()

    expect(onEdit).toHaveBeenCalledWith(match)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('removes the match from the store after the user confirms the deletion', async () => {
    seedTeam()
    const match = winningMatch()
    hydrateMatchs([match.getRawData()])
    const { container } = renderView(() => <BsMatchTile match={match} />)

    getButton(container, 'Supprimer le match').click()
    await flushMacrotasks()
    clickDialogButton('btn-success')
    await flushMacrotasks()

    expect(getRawMatchs().map((raw) => raw.id)).not.toContain(match.id)
  })

  it('keeps the match when the user cancels the deletion', async () => {
    seedTeam()
    const match = winningMatch()
    hydrateMatchs([match.getRawData()])
    const { container } = renderView(() => <BsMatchTile match={match} />)

    getButton(container, 'Supprimer le match').click()
    await flushMacrotasks()
    clickDialogButton('btn-warning')
    await flushMacrotasks()

    expect(getRawMatchs().map((raw) => raw.id)).toContain(match.id)
  })

  it('does not trigger onStart when the delete button is clicked', () => {
    seedTeam()
    const onStart = vi.fn()
    const { container } = renderView(() => <BsMatchTile match={winningMatch()} onStart={onStart} />)

    getButton(container, 'Supprimer le match').click()

    expect(onStart).not.toHaveBeenCalled()
  })
})
