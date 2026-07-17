// Deterministic monotonic counters per factory family.
// Module-level state — reset via resetMockCounters() in tests.
let counters: Record<string, number> = {}

export function nextId(prefix: string): string {
  const current = counters[prefix] ?? 0
  const next = current + 1
  counters[prefix] = next
  return `${prefix}-${next}`
}

export function resetCounters(): void {
  counters = {}
}
