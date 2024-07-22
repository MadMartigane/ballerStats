const antropyFator = 3

export function getUniqId(): number {
  const array = new Uint32Array(antropyFator)
  crypto.getRandomValues(array)
  return array[Math.floor(Math.random() * antropyFator)]
}

export function getShortId(): number {
  return Math.floor(Math.random() * 100000)
}

export function clone(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data))
}
