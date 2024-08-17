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

export function goTo(path: string) {
  window.location.hash = path
}

export function goBack() {
  window.history.back()
}
