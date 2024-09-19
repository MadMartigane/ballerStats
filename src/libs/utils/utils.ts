const antropyFator = 3;

export function getUniqId(): string {
  const array = new Uint32Array(antropyFator);
  crypto.getRandomValues(array);
  return String(array[Math.floor(Math.random() * antropyFator)]);
}

export function getShortId(): string {
  return String(Math.floor(Math.random() * 100000));
}

export function clone(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data));
}

export function scrollTop() {
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 100);
}

export function scrollBottom() {
  setTimeout(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight - window.innerHeight,
      behavior: 'smooth',
    });
  }, 100);
}

export function goTo(path: string) {
  window.location.hash = path;
  scrollTop();
}

export function goBack() {
  // Do not use timeout here
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.history.back();
}

export function mount(child: HTMLElement, parent?: HTMLElement) {
  if (!parent) {
    parent = document.body;
  }

  parent.appendChild(child);
}

export function unmount(child: HTMLElement, parent?: HTMLElement) {
  if (!parent) {
    parent = document.body;
  }

  return setTimeout(() => {
    parent?.removeChild(child);
  });
}

export async function confirmAction(
  title = 'Confirmation',
  message = 'Cette action est définitive, continuer ?',
  cancel = 'Non',
  confirm = 'Oui',
): Promise<boolean> {
  let resolve: (value: boolean) => void | null;
  const promise: Promise<boolean> = new Promise((res) => {
    resolve = res;
  });

  const dialogId = `dialog-confirm-${getShortId()}`;
  const dialogEl: HTMLDialogElement = document.createElement('dialog');
  dialogEl.id = dialogId;
  dialogEl.classList.add('modal', 'modal-bottom', 'sm:modal-middle');

  const modalBox: HTMLDivElement = document.createElement('div');
  modalBox.classList.add('modal-box', 'w-full');
  dialogEl.append(modalBox);

  //    <h3 class="text-lg font-bold">Hello!</h3>
  const titleEl: HTMLDivElement = document.createElement('h3');
  titleEl.innerText = title;
  titleEl.innerText = `🚨 ${title}`;
  modalBox.append(titleEl);

  //    <p class="py-4">Press ESC key or click the button below to close</p>
  const questionEl: HTMLParagraphElement = document.createElement('p');
  questionEl.innerText = message;
  questionEl.classList.add('py-4', 'alert', 'my-4', 'alert-info', 'w-full');
  questionEl.role = 'alert';
  modalBox.append(questionEl);

  //     <div class="modal-action">
  const modalAction: HTMLDivElement = document.createElement('div');
  modalAction.classList.add('modal-action');
  modalBox.append(modalAction);

  //      <form method="dialog">
  const modalForm: HTMLFormElement = document.createElement('form');
  modalForm.method = 'dialog';
  modalForm.classList.add('flex', 'flex-row', 'w-full', 'gap-4');
  modalAction.append(modalForm);

  const cancelButton: HTMLButtonElement = document.createElement('button');
  const confirmButton: HTMLButtonElement = document.createElement('button');

  cancelButton.innerText = cancel;
  cancelButton.classList.add('btn', 'btn-warning', 'basis-1/2');

  confirmButton.innerText = confirm;
  confirmButton.classList.add('btn', 'btn-success', 'basis-1/2');

  modalForm.append(cancelButton);
  modalForm.append(confirmButton);

  document.body.appendChild(dialogEl);
  dialogEl.showModal();

  cancelButton.addEventListener('click', () => {
    unmount(dialogEl);
    resolve(false);
  });

  confirmButton.addEventListener('click', () => {
    unmount(dialogEl);
    resolve(true);
  });

  return promise;
}

export function toDateTime(dateString: string | null) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  return `${date.toLocaleDateString('fr-FR')} - ${date.toLocaleTimeString('fr-FR').replace(/:\d{2}$/, '')}`;
}
