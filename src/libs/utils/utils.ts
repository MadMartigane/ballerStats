const antropyFator = 3

export function getUniqId(): string {
  const array = new Uint32Array(antropyFator)
  crypto.getRandomValues(array)
  return String(array[Math.floor(Math.random() * antropyFator)])
}

export function getShortId(): string {
  return String(Math.floor(Math.random() * 100000))
}

export function clone(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data))
}

export function scrollTop() {
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, 100)
}

export function scrollBottom() {
  setTimeout(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight - window.innerHeight,
      behavior: 'smooth',
    })
  }, 100)
}

export function goTo(path: string) {
  window.location.hash = path
  scrollTop()
}

export function goBack() {
  // Do not use timeout here
  window.scrollTo({ top: 0, behavior: 'smooth' })
  window.history.back()
}
