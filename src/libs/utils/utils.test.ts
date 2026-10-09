import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clone,
  confirmAction,
  downloadBlob,
  getShortId,
  getUniqId,
  goBack,
  goTo,
  mount,
  scrollBottom,
  scrollTop,
  toast,
  toDateTime,
  unmount,
} from './utils'

const TOAST_TIMEOUT_MS = 6000
const DOWNLOAD_REVOKE_DELAY_MS = 1000
const SCROLL_DELAY_MS = 100
const UINT32_MAX = 4_294_967_295
const NUMERIC_ID_REGEX = /^\d+$/
const SHORT_ID_REGEX = /^\d{1,5}$/
const TOAST_INFO_ID_REGEX = /^bs-template-store-alert-info-\d+$/

async function flushMacrotasks(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function setScrollHeight(value: number): () => void {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value })
  return () => {
    Reflect.deleteProperty(document.documentElement, 'scrollHeight')
  }
}

function buildToastTemplates(): void {
  const store = document.createElement('div')
  store.id = 'bs-template-store'
  for (const variant of ['success', 'warning', 'error', 'info']) {
    const template = document.createElement('div')
    template.id = `bs-template-store-alert-${variant}`
    const message = document.createElement('span')
    message.id = 'message'
    template.append(message)
    store.append(template)
  }
  const container = document.createElement('div')
  container.id = 'bs-global-toast'
  document.body.append(store, container)
}

function getDialogButton(kind: 'cancel' | 'confirm'): HTMLButtonElement | null {
  const className = kind === 'confirm' ? 'btn-success' : 'btn-warning'
  return document.querySelector<HTMLButtonElement>(`dialog button.${className}`)
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await flushMacrotasks()
  document.body.innerHTML = ''
  window.location.hash = ''
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

describe('getUniqId', () => {
  it('returns a numeric string within the Uint32 range', () => {
    const id = getUniqId()

    expect(id).toMatch(NUMERIC_ID_REGEX)
    expect(Number(id)).toBeLessThanOrEqual(UINT32_MAX)
  })

  it('draws its entropy from crypto.getRandomValues', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues')

    getUniqId()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[0]).toBeInstanceOf(Uint32Array)
    expect(spy.mock.calls[0]?.[0]).toHaveLength(3)
  })
})

describe('getShortId', () => {
  it('returns a string of at most five digits', () => {
    const id = getShortId()

    expect(id).toMatch(SHORT_ID_REGEX)
  })

  it('maps Math.random 0 to "0" and values near 1 to the top of the range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(getShortId()).toBe('0')

    vi.spyOn(Math, 'random').mockReturnValue(0.999_999)
    expect(getShortId()).toBe('99999')
  })
})

describe('clone', () => {
  it('deep copies a nested object and returns a new reference', () => {
    const source = { meta: { tags: ['a', 'b'] }, name: 'bs' }

    const copy = clone(source)

    expect(copy).toEqual(source)
    expect(copy).not.toBe(source)
    expect((copy as typeof source).meta).not.toBe(source.meta)
  })

  it('deep copies an array and returns a new reference', () => {
    const source = [{ id: 1 }, { id: 2 }]

    const copy = clone(source)

    expect(copy).toEqual(source)
    expect(copy).not.toBe(source)
    expect((copy as typeof source)[0]).not.toBe(source[0])
  })

  it('drops values JSON cannot represent, such as undefined', () => {
    const copy = clone({ gone: undefined, kept: 1 })

    expect(copy).toEqual({ kept: 1 })
    expect(Object.keys(copy as object)).toEqual(['kept'])
  })
})

describe('scrollTop', () => {
  it('scrolls the window smoothly to the top after 100 ms', () => {
    vi.useFakeTimers()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    scrollTop()
    expect(scrollTo).not.toHaveBeenCalled()

    vi.advanceTimersByTime(SCROLL_DELAY_MS)
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 0 })
  })
})

describe('scrollBottom', () => {
  it('scrolls to scrollHeight minus innerHeight after 100 ms', () => {
    vi.useFakeTimers()
    const restoreHeight = setScrollHeight(2000)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    scrollBottom()
    vi.advanceTimersByTime(SCROLL_DELAY_MS)

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: 'smooth',
      top: 2000 - window.innerHeight,
    })
    restoreHeight()
  })
})

describe('goTo', () => {
  it('sets the location hash and schedules a scroll to the top', () => {
    vi.useFakeTimers()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)

    goTo('/stats')
    expect(window.location.hash).toBe('#/stats')

    vi.advanceTimersByTime(SCROLL_DELAY_MS)
    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 0 })
  })
})

describe('goBack', () => {
  it('scrolls to top immediately and calls history.back without a timeout', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)

    goBack()

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: 0 })
    expect(back).toHaveBeenCalledTimes(1)
  })
})

describe('mount and unmount', () => {
  it('appends to document.body when no parent is given', () => {
    const child = document.createElement('div')

    mount(child)

    expect(child.parentElement).toBe(document.body)
  })

  it('appends to the explicit parent when provided', () => {
    const parent = document.createElement('section')
    const child = document.createElement('div')
    document.body.append(parent)

    mount(child, parent)

    expect(child.parentElement).toBe(parent)
  })

  it('removes the child from document.body on the next macrotask', async () => {
    const child = document.createElement('div')
    document.body.append(child)

    unmount(child)
    expect(child.isConnected).toBe(true)

    await flushMacrotasks()
    expect(child.isConnected).toBe(false)
  })

  it('removes the child from an explicit parent and returns the timer handle', async () => {
    const parent = document.createElement('section')
    const child = document.createElement('div')
    parent.append(child)
    document.body.append(parent)

    const handle = unmount(child, parent)
    expect(handle).toBeDefined()

    await flushMacrotasks()
    expect(parent.contains(child)).toBe(false)
  })
})

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('clicks a hidden anchor carrying the object URL and file name', () => {
    const clickedAnchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedAnchors.push(this)
    })

    downloadBlob(new Blob(['x']), 'export.csv')

    expect(clickedAnchors).toHaveLength(1)
    const [anchor] = clickedAnchors
    expect(anchor?.getAttribute('href')).toBe('blob:mock-url')
    expect(anchor?.getAttribute('download')).toBe('export.csv')
    expect(anchor?.style.visibility).toBe('hidden')
    expect(anchor?.isConnected).toBe(true)
  })

  it('removes the anchor and revokes the URL after the delay', () => {
    const clickedAnchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedAnchors.push(this)
    })
    const revoke = vi.mocked(URL.revokeObjectURL)

    downloadBlob(new Blob(['x']), 'export.csv')

    vi.advanceTimersByTime(0)
    expect(clickedAnchors[0]?.isConnected).toBe(false)
    expect(revoke).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DOWNLOAD_REVOKE_DELAY_MS)
    expect(revoke).toHaveBeenCalledWith('blob:mock-url')
  })
})

describe('confirmAction', () => {
  it('resolves true when the confirm button is clicked and removes the dialog', async () => {
    const pending = confirmAction('Supprimer', 'Sûr ?', 'Non', 'Oui')
    const dialog = document.querySelector('dialog')
    const confirmButton = getDialogButton('confirm')

    expect(dialog?.open).toBe(true)
    confirmButton?.click()

    await expect(pending).resolves.toBe(true)
    await flushMacrotasks()
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('resolves false when the cancel button is clicked', async () => {
    const pending = confirmAction('Supprimer', 'Sûr ?', 'Non', 'Oui')
    const cancelButton = getDialogButton('cancel')

    cancelButton?.click()

    await expect(pending).resolves.toBe(false)
  })

  it('resolves false when the dialog emits cancel (Escape)', async () => {
    const pending = confirmAction()
    document.querySelector('dialog')?.dispatchEvent(new Event('cancel'))

    await expect(pending).resolves.toBe(false)
  })

  it('resolves false when the dialog emits close', async () => {
    const pending = confirmAction()
    document.querySelector('dialog')?.dispatchEvent(new Event('close'))

    await expect(pending).resolves.toBe(false)
  })

  it('settles only once when several controls are triggered', async () => {
    const pending = confirmAction()
    const dialog = document.querySelector('dialog')
    const confirmButton = getDialogButton('confirm')
    const cancelButton = getDialogButton('cancel')

    confirmButton?.click()
    cancelButton?.click()
    dialog?.dispatchEvent(new Event('close'))

    await expect(pending).resolves.toBe(true)
  })

  it('uses the default title, message and labels when none are given', async () => {
    const pending = confirmAction()
    const dialog = document.querySelector('dialog')

    expect(dialog?.querySelector<HTMLElement>('h3')?.innerText).toBe('🚨 Confirmation')
    expect(dialog?.querySelector<HTMLElement>('p')?.innerText).toBe('Cette action est définitive, continuer ?')
    const labels = [...(dialog?.querySelectorAll('button') ?? [])].map((b) => (b as HTMLElement).innerText)
    expect(labels).toEqual(['Non', 'Oui', 'close'])

    dialog?.dispatchEvent(new Event('cancel'))
    await pending
  })
})

describe('toDateTime', () => {
  it('returns an empty string for null', () => {
    expect(toDateTime(null)).toBe('')
  })

  it('returns an empty string for an empty string', () => {
    expect(toDateTime('')).toBe('')
  })

  it('formats a valid ISO string as fr-FR date and time without seconds', () => {
    expect(toDateTime('2024-03-05T14:30:00')).toBe('05/03/2024 - 14:30')
  })

  it('reports an invalid date string instead of throwing', () => {
    expect(toDateTime('not-a-date')).toBe('Invalid Date - Invalid Date')
  })
})

describe('toast', () => {
  beforeEach(() => {
    buildToastTemplates()
    vi.useFakeTimers()
  })

  it('clones the info template by default and writes the message', () => {
    toast('Bonjour')

    const toastEl = document.querySelector('#bs-global-toast > div')
    expect(toastEl?.id).toMatch(TOAST_INFO_ID_REGEX)
    expect(toastEl?.querySelector<HTMLElement>('#message')?.innerText).toBe('Bonjour')
  })

  it.each([
    ['success', 'bs-template-store-alert-success'],
    ['warning', 'bs-template-store-alert-warning'],
    ['error', 'bs-template-store-alert-error'],
  ] as const)('clones the %s template for the matching variant', (variant, templateId) => {
    toast('msg', variant)

    const toastEl = document.querySelector('#bs-global-toast > div')
    expect(toastEl?.id.startsWith(`${templateId}-`)).toBe(true)
  })

  it('dismisses the toast automatically after 6 seconds', () => {
    toast('auto')
    const container = document.getElementById('bs-global-toast')

    vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1)
    expect(container?.children).toHaveLength(1)

    vi.advanceTimersByTime(1)
    vi.advanceTimersByTime(1)
    expect(container?.children).toHaveLength(0)
  })

  it('dismisses the toast when the clone is clicked', () => {
    toast('click me')
    const container = document.getElementById('bs-global-toast')
    const toastEl = container?.firstElementChild as HTMLDivElement

    toastEl.click()
    vi.advanceTimersByTime(0)

    expect(container?.children).toHaveLength(0)
  })

  it('throws when the template for the variant is missing', () => {
    document.getElementById('bs-template-store-alert-error')?.remove()

    expect(() => toast('boom', 'error')).toThrow('Unable to find the dialog item in the template store.')
  })

  it('throws when the cloned template has no #message element', () => {
    document.querySelector('#bs-template-store-alert-info #message')?.remove()

    expect(() => toast('no slot')).toThrow('Unable to find the message item in the toast dialog.')
  })
})
