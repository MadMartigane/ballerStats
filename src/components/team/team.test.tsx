import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlayer } from '../../libs/mock/factories/player.factory'
import { makeTeam } from '../../libs/mock/factories/team.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { hydrateContacts } from '../../libs/stores/contacts-store'
import { hydratePlayers } from '../../libs/stores/players-store'
import { getRawTeams, hydrateTeams } from '../../libs/stores/teams-store'
import { installToastHost, renderInRouter } from '../test-utils'
import BsTeam from './team'
import type { BsTeamProps } from './team.d'

const TEAM_ID = 'team-card-1'

function renderTeam(props: { team: ReturnType<typeof makeTeam>; onEdit?: BsTeamProps['onEdit'] }) {
  // BsTeamProps types onEdit as required, but the component guards it with <Show>.
  // The cast lets tests exercise the real runtime path where the handler is absent.
  const onEdit = props.onEdit as BsTeamProps['onEdit']
  return renderInRouter(() => <BsTeam onEdit={onEdit} team={props.team} />)
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

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) {
    throw new Error(`Button "${label}" not found`)
  }
  return button
}

function getAnchor(container: HTMLElement, label: string): HTMLAnchorElement {
  const anchor = container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`)
  if (!anchor) {
    throw new Error(`Link "${label}" not found`)
  }
  return anchor
}

async function flushMacrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

describe('BsTeam', () => {
  beforeEach(() => {
    resetCounters()
    stubDialog()
    hydrateTeams([])
    hydratePlayers([])
    hydrateContacts([])
  })

  afterEach(() => {
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.remove()
    }
    unstubDialog()
    vi.restoreAllMocks()
  })

  it('renders the team name as the title', () => {
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles' })
    const { container } = renderTeam({ team })

    expect(container.querySelector('h2')?.textContent).toBe('Les Aigles')
  })

  it('renders an empty title when the team has no name', () => {
    const team = makeTeam({ id: TEAM_ID, name: null })
    const { container } = renderTeam({ team })

    expect(container.querySelector('h2')).toBeNull()
  })

  it('shows the category and the count of players that resolve in the store', () => {
    hydratePlayers([makePlayer({ id: 'p1' }).getRawData(), makePlayer({ id: 'p2' }).getRawData()])
    const team = makeTeam({ category: 'U13', id: TEAM_ID, playerIds: ['p1', 'p2', 'ghost'] })
    const { container } = renderTeam({ team })

    expect(container.textContent).toContain('Catégorie : U13 — Nombre de joueurs : 2')
  })

  it('omits the category prefix when the team has no category', () => {
    const team = makeTeam({ category: null, id: TEAM_ID, playerIds: [] })
    const { container } = renderTeam({ team })

    expect(container.textContent).toContain('Nombre de joueurs : 0')
    expect(container.textContent).not.toContain('Catégorie')
  })

  it('lists each resolved player with jersey, nickname preferred over first name, and last name', () => {
    hydratePlayers([
      makePlayer({ id: 'p1', jerseyNumber: '7', lastName: 'Durand', nicName: 'Dudu' }).getRawData(),
      makePlayer({ firstName: 'Léa', id: 'p2', jerseyNumber: '12', lastName: 'Martin' }).getRawData(),
    ])
    const team = makeTeam({ id: TEAM_ID, playerIds: ['p1', 'p2'] })
    const { container } = renderTeam({ team })

    const rows = Array.from(container.querySelectorAll('div.mt-4 p')).map((row) => row.textContent)
    expect(rows).toEqual(['7Dudu Durand', '12Léa Martin'])
  })

  it('flags a player id that cannot be found in the store as an error line', () => {
    const team = makeTeam({ id: TEAM_ID, playerIds: ['ghost-9'] })
    const { container } = renderTeam({ team })

    const missing = container.querySelector('p.text-error')
    expect(missing?.textContent).toBe('Joueur id ghost-9 introuvable')
  })

  it('exports the team emails as a txt download when at least one player has an email', async () => {
    hydratePlayers([makePlayer({ email: 'coach@example.com', id: 'p1' }).getRawData()])
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles', playerIds: ['p1'] })
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock')
    URL.createObjectURL = createObjectURL
    const removeToastHost = installToastHost()
    const { container } = renderTeam({ team })

    getButton(container, "Exporter les emails de l'équipe Les Aigles").click()
    await flushMacrotasks()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe('coach@example.com\n')
    removeToastHost()
  })

  it('calls onEdit with the team when the edit button is clicked', () => {
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles' })
    const onEdit = vi.fn()
    const { container } = renderTeam({ onEdit, team })

    getButton(container, "Modifier l'équipe Les Aigles").click()

    expect(onEdit).toHaveBeenCalledWith(team)
  })

  it('hides the edit button when no onEdit handler is provided', () => {
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles' })
    const { container } = renderTeam({ team })

    expect(container.querySelector('button[aria-label="Modifier l\'équipe Les Aigles"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Supprimer l\'équipe Les Aigles"]')).not.toBeNull()
  })

  it('links to the team trombinoscope route', () => {
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles' })
    const { container } = renderTeam({ team })

    expect(getAnchor(container, "Trombinoscope de l'équipe Les Aigles").getAttribute('href')).toBe(`/trombi/${TEAM_ID}`)
  })

  it('removes the team from the store only after the user confirms', async () => {
    const team = makeTeam({ id: TEAM_ID, name: 'Les Aigles' })
    hydrateTeams([team.getRawData()])
    const { container } = renderTeam({ team })

    getButton(container, "Supprimer l'équipe Les Aigles").click()
    await flushMacrotasks()
    const dialogs = document.querySelectorAll('dialog')
    expect(dialogs.length).toBeGreaterThan(0)
    const confirm = dialogs.item(dialogs.length - 1)?.querySelector<HTMLButtonElement>('button.btn-success')
    confirm?.click()
    await flushMacrotasks()

    expect(getRawTeams().map((raw) => raw.id)).not.toContain(TEAM_ID)
  })
})
