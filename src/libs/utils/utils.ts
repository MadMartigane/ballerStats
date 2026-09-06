import type { DaisyAlert } from '../daisy/daisy.d'

const antropyFator = 3

// Hoisted to module scope: used by toDateTime on every call.
const TIME_WITHOUT_SECONDS_REGEX = /:\d{2}$/

export function getUniqId(): string {
  const array = new Uint32Array(antropyFator)
  crypto.getRandomValues(array)
  return String(array[Math.floor(Math.random() * antropyFator)])
}

export function getShortId(): string {
  return String(Math.floor(Math.random() * 100_000))
}

export function clone(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data))
}

export function scrollTop() {
  setTimeout(() => {
    window.scrollTo({ behavior: 'smooth', top: 0 })
  }, 100)
}

export function scrollBottom() {
  setTimeout(() => {
    window.scrollTo({
      behavior: 'smooth',
      top: document.documentElement.scrollHeight - window.innerHeight,
    })
  }, 100)
}

export function goTo(path: string) {
  window.location.hash = path
  scrollTop()
}

export function goBack() {
  // Do not use timeout here
  window.scrollTo({ behavior: 'smooth', top: 0 })
  window.history.back()
}

export function mount(child: HTMLElement, parent?: HTMLElement | null) {
  const realParent = parent || document.body

  realParent.appendChild(child)
}

export function unmount(child: HTMLElement, parent?: HTMLElement | null) {
  const realParent = parent || document.body

  return setTimeout(() => {
    realParent.removeChild(child)
  })
}

/** Trigger a browser download of a Blob via a hidden anchor, using the shared mount/unmount pattern. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.setAttribute('href', url)
  anchor.setAttribute('download', fileName)
  anchor.style.visibility = 'hidden'
  mount(anchor)
  anchor.click()
  unmount(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function confirmAction(
  title = 'Confirmation',
  message = 'Cette action est définitive, continuer ?',
  cancel = 'Non',
  confirm = 'Oui'
): Promise<boolean> {
  let resolve: (value: boolean | PromiseLike<boolean>) => void
  const promise: Promise<boolean> = new Promise((res) => {
    resolve = res
  })

  const dialogId = `dialog-confirm-${getShortId()}`
  const dialogEl: HTMLDialogElement = document.createElement('dialog')
  dialogEl.id = dialogId
  dialogEl.className = 'modal modal-middle'

  const modalBox: HTMLDivElement = document.createElement('div')
  modalBox.className =
    'modal-box w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto mx-auto my-auto px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
  dialogEl.append(modalBox)

  //    <h3 class="text-lg font-bold">Hello!</h3>
  const titleEl: HTMLDivElement = document.createElement('h3')
  titleEl.innerText = title
  titleEl.innerText = `🚨 ${title}`
  titleEl.classList.add('font-bold', 'text-lg', 'break-words')
  modalBox.append(titleEl)

  //    <p class="py-4">Press ESC key or click the button below to close</p>
  const questionEl: HTMLParagraphElement = document.createElement('p')
  questionEl.innerText = message
  questionEl.classList.add('py-4', 'text-sm', 'sm:text-base', 'break-words')
  questionEl.role = 'alert'
  modalBox.append(questionEl)

  //     <div class="modal-action">
  const modalAction: HTMLDivElement = document.createElement('div')
  modalAction.classList.add('modal-action')
  modalBox.append(modalAction)

  //      <form method="dialog">
  const modalForm: HTMLFormElement = document.createElement('form')
  modalForm.method = 'dialog'
  modalForm.classList.add('flex', 'flex-row', 'w-full', 'gap-4')
  modalAction.append(modalForm)

  const cancelButton: HTMLButtonElement = document.createElement('button')
  const confirmButton: HTMLButtonElement = document.createElement('button')

  cancelButton.innerText = cancel
  cancelButton.classList.add('btn', 'btn-warning', 'basis-1/2', 'min-h-[3rem]')

  confirmButton.innerText = confirm
  confirmButton.classList.add('btn', 'btn-success', 'basis-1/2', 'min-h-[3rem]')

  modalForm.append(cancelButton)
  modalForm.append(confirmButton)

  // Backdrop click closes the dialog (DaisyUI pattern)
  const backdropForm: HTMLFormElement = document.createElement('form')
  backdropForm.method = 'dialog'
  backdropForm.className = 'modal-backdrop'
  const backdropButton: HTMLButtonElement = document.createElement('button')
  backdropButton.innerText = 'close'
  backdropForm.append(backdropButton)
  dialogEl.append(backdropForm)

  let settled = false

  function settleDialog(value: boolean) {
    if (settled) {
      return
    }
    settled = true
    resolve(value)
    unmount(dialogEl)
  }

  document.body.appendChild(dialogEl)
  dialogEl.showModal()

  dialogEl.addEventListener('close', () => {
    settleDialog(false)
  })

  dialogEl.addEventListener('cancel', () => {
    settleDialog(false)
  })

  cancelButton.addEventListener('click', () => {
    settleDialog(false)
  })

  confirmButton.addEventListener('click', () => {
    settleDialog(true)
  })

  return promise
}

export function toDateTime(dateString: string | null) {
  if (!dateString) {
    return ''
  }

  const date = new Date(dateString)
  return `${date.toLocaleDateString('fr-FR')} - ${date.toLocaleTimeString('fr-FR').replace(TIME_WITHOUT_SECONDS_REGEX, '')}`
}

export function toast(message: string, variant?: DaisyAlert) {
  const toastContainer = document.getElementById('bs-global-toast') as HTMLDivElement

  let dialogTemplate: HTMLDivElement | null
  switch (variant) {
    case 'success':
      dialogTemplate = document.querySelector('#bs-template-store > #bs-template-store-alert-success')
      break
    case 'warning':
      dialogTemplate = document.querySelector('#bs-template-store > #bs-template-store-alert-warning')
      break
    case 'error':
      dialogTemplate = document.querySelector('#bs-template-store > #bs-template-store-alert-error')
      break
    default:
      dialogTemplate = document.querySelector('#bs-template-store > #bs-template-store-alert-info')
      break
  }

  if (!dialogTemplate) {
    throw new Error('Unable to find the dialog item in the template store.')
  }

  const dialog = dialogTemplate.cloneNode(true) as HTMLDivElement
  mount(dialog, toastContainer)

  dialog.id = `${dialog.id}-${getShortId()}`
  dialog.onclick = () => {
    unmount(dialog, toastContainer)
  }

  const span = dialog.querySelector('#message') as HTMLDivElement
  if (!span) {
    throw new Error('Unable to find the message item in the toast dialog.')
  }
  span.innerText = message

  const timeout = setTimeout(() => {
    unmount(dialog, toastContainer)
  }, 6000)

  dialogTemplate.onclick = () => {
    unmount(dialog, toastContainer)
    clearTimeout(timeout)
  }
}
