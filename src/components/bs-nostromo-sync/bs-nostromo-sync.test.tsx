import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authWithPassword, NostromoClientError } from '../../libs/nostromo/client'
import { clearConfig, getConfig, setConfig } from '../../libs/nostromo/nostromo-config-store'
import type { NostromoConfig } from '../../libs/nostromo/nostromo-config-store.d'
import {
  getAllBaselines,
  hydrateNostromoSync,
  nostromoSync,
  setBaseline,
  setNostromoSyncStatus,
} from '../../libs/nostromo/nostromo-sync-store'
import type { NostromoStatus } from '../../libs/nostromo/nostromo-sync-store.d'
import { flushNostromoPush, getConflictedUnits } from '../../libs/nostromo/push-engine'
import { confirmNostromoRestore, planNostromoRestore } from '../../libs/nostromo/restore'
import type { NostromoRestorePlan } from '../../libs/nostromo/restore.d'
import {
  describeNostromoAuthError,
  describeNostromoConflict,
  formatNostromoLogTime,
  NOSTROMO_STATUS_CHIP_LABEL,
  NOSTROMO_STATUS_LABELS,
  NOSTROMO_STATUS_VARIANTS,
  normalizeNostromoBaseUrl,
} from './bs-nostromo-status'
import BsNostromoStatusChip from './bs-nostromo-status-chip'
import BsNostromoSyncCard from './bs-nostromo-sync-card'

vi.mock('../../libs/nostromo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../libs/nostromo/client')>()),
  authWithPassword: vi.fn(),
}))

vi.mock('../../libs/nostromo/env', () => ({
  getNostromoBaseUrl: () => 'https://nostromo.test',
}))

vi.mock('../../libs/nostromo/nostromo-config-store', () => ({
  clearConfig: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}))

vi.mock('../../libs/nostromo/push-engine', () => ({
  flushNostromoPush: vi.fn(() => Promise.resolve()),
  getConflictedUnits: vi.fn(() => []),
}))

vi.mock('../../libs/nostromo/restore', () => ({
  confirmNostromoRestore: vi.fn(() => Promise.resolve(undefined)),
  planNostromoRestore: vi.fn(),
}))

vi.mock('../../libs/utils/utils', () => ({ toast: vi.fn() }))

// Hoisted to module scope: the lint rule forbids a regex literal inside a test body.
const LOCAL_DATE_TIME_PATTERN = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/

/** Warning text of the plan fixture: French, exactly like the sync layer produces it. */
const PLAN_WARNING =
  'players: la copie du serveur est plus récente que la référence locale (version distante 3, référence 2), la restauration écrase les données locales.'
const SERVER_EMAIL = 'coach@club.fr'
const SERVER_PASSWORD = 'secret'
const CONNECTED_CONFIG: NostromoConfig = {
  baseUrl: 'https://nostromo.test',
  email: SERVER_EMAIL,
  token: 'token-1',
  userId: 'user-1',
}

function makePlan(overrides: Partial<NostromoRestorePlan> = {}): NostromoRestorePlan {
  return {
    collectionUnits: [],
    fetchedAt: 1_700_000_000_000,
    localPhotoCount: 0,
    photoUnits: [],
    remoteDocumentCount: 4,
    remotePhotoCount: 0,
    requiresConfirmation: true,
    warnings: [PLAN_WARNING],
    ...overrides,
  }
}

function requireButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
    candidate.textContent?.includes(label)
  )
  if (!button) {
    throw new Error(`Button "${label}" is not rendered.`)
  }
  return button
}

function requireInput(index: number): HTMLInputElement {
  const input = Array.from(document.querySelectorAll<HTMLInputElement>('input')).at(index)
  if (!input) {
    throw new Error(`Input #${index} is not rendered.`)
  }
  return input
}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submitForm(): void {
  const form = document.querySelector('form')
  if (!form) {
    throw new Error('The sign-in form is not rendered.')
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('nostromo status view mapping', () => {
  it('labels the mandated statuses in French', () => {
    const required: Partial<Record<NostromoStatus, string>> = {
      'auth-required': 'Reconnexion requise',
      conflict: 'Conflit',
      error: 'Erreur',
      pending: 'En attente',
      saved: 'Synchronisé',
      saving: 'Sauvegarde…',
      unconfigured: 'Non configuré',
    }

    for (const [status, label] of Object.entries(required)) {
      expect(NOSTROMO_STATUS_LABELS[status as NostromoStatus]).toBe(label)
    }
  })

  it('gives every status a label and a colour variant', () => {
    const statuses: NostromoStatus[] = [
      'auth-required',
      'conflict',
      'error',
      'off',
      'pending',
      'saved',
      'saving',
      'unconfigured',
    ]

    for (const status of statuses) {
      expect(NOSTROMO_STATUS_LABELS[status].length).toBeGreaterThan(0)
      expect(NOSTROMO_STATUS_VARIANTS[status]).toBeDefined()
    }
  })

  it('maps the colours of the critical statuses', () => {
    expect(NOSTROMO_STATUS_VARIANTS.saved).toBe('success')
    expect(NOSTROMO_STATUS_VARIANTS.pending).toBe('warning')
    expect(NOSTROMO_STATUS_VARIANTS.saving).toBe('info')
    expect(NOSTROMO_STATUS_VARIANTS.error).toBe('error')
    expect(NOSTROMO_STATUS_VARIANTS.conflict).toBe('error')
    expect(NOSTROMO_STATUS_VARIANTS['auth-required']).toBe('warning')
    expect(NOSTROMO_STATUS_VARIANTS.off).toBe('neutral')
    expect(NOSTROMO_STATUS_VARIANTS.unconfigured).toBe('neutral')
  })

  it('formats log timestamps in French, relative while recent', () => {
    const now = 1_700_000_000_000

    expect(formatNostromoLogTime(now - 5000, now)).toBe("à l'instant")
    expect(formatNostromoLogTime(now - 120_000, now)).toBe('il y a 2 min')
    expect(formatNostromoLogTime(now - 3 * 3_600_000, now)).toBe('il y a 3 h')
    expect(formatNostromoLogTime(now - 2 * 86_400_000, now)).toMatch(LOCAL_DATE_TIME_PATTERN)
  })

  it('maps a refused sign-in to a French message', () => {
    expect(describeNostromoAuthError(new NostromoClientError('refused', { kind: 'validation' }))).toBe(
      'Identifiants invalides.'
    )
    expect(describeNostromoAuthError(new NostromoClientError('offline', { kind: 'network' }))).toBe(
      'Serveur injoignable.'
    )
    expect(describeNostromoAuthError(new Error('boom'))).toBe('Connexion au serveur impossible.')
  })

  it('normalizes the server address typed by the user', () => {
    expect(normalizeNostromoBaseUrl('  https://nostromo.test/  ')).toBe('https://nostromo.test')
    expect(normalizeNostromoBaseUrl('http://localhost:8090')).toBe('http://localhost:8090')
  })

  it('names the conflicted units in the conflict banner text', () => {
    expect(describeNostromoConflict([])).toBe('Des données locales sont en conflit avec le serveur.')
    expect(describeNostromoConflict(['players', 'matchs'])).toBe(
      'Des données locales sont en conflit avec le serveur. Éléments concernés : players, matchs.'
    )
  })
})

describe('BsNostromoStatusChip', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
    document.body.innerHTML = ''
  })

  it('renders the French label of the given status', () => {
    dispose = render(() => <BsNostromoStatusChip status="saved" />, document.body)

    expect(document.body.textContent).toContain('Synchronisé')
  })

  it('renders the conflict label and stays inert without a click handler', () => {
    dispose = render(() => <BsNostromoStatusChip status="conflict" />, document.body)

    expect(document.body.textContent).toContain('Conflit')
    expect(document.querySelector('button')).toBeNull()
  })

  it('exposes an accessible button name and reports its click to the parent', () => {
    const onClick = vi.fn()
    dispose = render(() => <BsNostromoStatusChip hasMenu onClick={onClick} status="auth-required" />, document.body)

    const button = document.querySelector('button')
    expect(button?.getAttribute('aria-label')).toBe(NOSTROMO_STATUS_CHIP_LABEL)
    expect(button?.getAttribute('aria-expanded')).toBe('false')

    button?.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('BsNostromoSyncCard', () => {
  let dispose: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    hydrateNostromoSync()
    vi.mocked(getConfig).mockReturnValue(undefined)
    vi.mocked(planNostromoRestore).mockResolvedValue(makePlan())
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
    document.body.innerHTML = ''
  })

  it('signs in with the prefilled server address and drains the queue', async () => {
    vi.mocked(authWithPassword).mockResolvedValue({ token: 'token-1', userId: 'user-1' })

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    expect(requireInput(0).value).toBe('https://nostromo.test')

    typeInto(requireInput(0), 'https://nostromo.test/')
    typeInto(requireInput(1), SERVER_EMAIL)
    typeInto(requireInput(2), SERVER_PASSWORD)
    submitForm()

    await vi.waitFor(() => {
      expect(authWithPassword).toHaveBeenCalledWith('https://nostromo.test', SERVER_EMAIL, SERVER_PASSWORD)
    })
    expect(setConfig).toHaveBeenCalledWith({
      baseUrl: 'https://nostromo.test',
      email: SERVER_EMAIL,
      token: 'token-1',
      userId: 'user-1',
    })
    await vi.waitFor(() => {
      expect(flushNostromoPush).toHaveBeenCalledTimes(1)
    })
    expect(document.body.textContent).not.toContain('Identifiants invalides.')
  })

  it('shows the French message of a refused sign-in and stores nothing', async () => {
    vi.mocked(authWithPassword).mockRejectedValue(new NostromoClientError('refused', { kind: 'validation' }))

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    typeInto(requireInput(1), SERVER_EMAIL)
    typeInto(requireInput(2), SERVER_PASSWORD)
    submitForm()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Identifiants invalides.')
    })
    expect(setConfig).not.toHaveBeenCalled()
    expect(flushNostromoPush).not.toHaveBeenCalled()
  })

  it('asks nothing of the server when the form is incomplete', async () => {
    dispose = render(() => <BsNostromoSyncCard />, document.body)

    submitForm()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Renseignez l'adresse du serveur")
    })
    expect(authWithPassword).not.toHaveBeenCalled()
  })

  it('shows the plan warnings and applies the decision the user made', async () => {
    const plan = makePlan()
    vi.mocked(getConfig).mockReturnValue(CONNECTED_CONFIG)

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    requireButton('Restaurer depuis Nostromo').click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(PLAN_WARNING)
    })
    expect(document.body.textContent).toContain('Vous allez écraser des données plus récentes.')

    const modalLabels = ['Annuler', 'Restaurer le serveur', 'Écraser le serveur']
    for (const label of modalLabels) {
      expect(requireButton(label)).toBeDefined()
    }

    requireButton('Écraser le serveur').click()

    await vi.waitFor(() => {
      expect(confirmNostromoRestore).toHaveBeenCalledWith(plan, 'overwrite')
    })
    expect(planNostromoRestore).toHaveBeenCalledTimes(1)
  })

  it('forwards the cancel decision without touching the data', async () => {
    vi.mocked(getConfig).mockReturnValue(CONNECTED_CONFIG)

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    requireButton('Restaurer depuis Nostromo').click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(PLAN_WARNING)
    })

    requireButton('Annuler').click()

    await vi.waitFor(() => {
      expect(confirmNostromoRestore).toHaveBeenCalledWith(makePlan(), 'cancel')
    })
  })

  it('keeps the modal busy and disabled while the decision is applied', async () => {
    let releaseApply: (() => void) | undefined
    vi.mocked(getConfig).mockReturnValue(CONNECTED_CONFIG)
    vi.mocked(confirmNostromoRestore).mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          releaseApply = () => resolve(undefined)
        })
    )

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    requireButton('Restaurer depuis Nostromo').click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(PLAN_WARNING)
    })

    requireButton('Restaurer le serveur').click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Traitement en cours…')
    })
    expect(requireButton('Écraser le serveur').disabled).toBe(true)
    expect(requireButton('Annuler').disabled).toBe(true)

    releaseApply?.()

    await vi.waitFor(() => {
      expect(document.querySelector('dialog.modal')).toBeNull()
    })
  })

  it('shows the conflict banner with a way into the restore modal', async () => {
    vi.mocked(getConfig).mockReturnValue(CONNECTED_CONFIG)
    vi.mocked(getConflictedUnits).mockReturnValue(['players', 'matchs'])
    setNostromoSyncStatus('conflict')

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    expect(document.body.textContent).toContain('Des données locales sont en conflit avec le serveur.')
    expect(document.body.textContent).toContain('players, matchs')

    requireButton('Résoudre le conflit').click()

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(PLAN_WARNING)
    })
  })

  it('forgets the credentials and the sync state of the account when the user disconnects', () => {
    vi.mocked(getConfig).mockReturnValue(CONNECTED_CONFIG)
    setNostromoSyncStatus('saved')
    setBaseline('players', { docId: 'pl0000000000001', savedAt: 1, version: 3 })

    dispose = render(() => <BsNostromoSyncCard />, document.body)

    requireButton('Se déconnecter').click()

    expect(clearConfig).toHaveBeenCalledTimes(1)
    expect(nostromoSync.status).toBe('off')
    // Document ids are account-independent: a second sign-in must not inherit them.
    expect(getAllBaselines()).toEqual({})
  })
})
