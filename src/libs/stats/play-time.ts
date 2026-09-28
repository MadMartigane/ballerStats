import type { MatchRawData, MatchStatLogEntry } from '../match/match.d'
import type { MatchFormatConfig } from '../team/match-format'
import { getMatchCeilingMinutes, getTheoreticalPlayerMinutes } from '../team/match-format'
import { TEAM_OPPONENT_ID } from '../team/team'

export type PlayTimeSource = 'table' | 'computed'

/** Default relative tolerance: |measured/theoretical - 1| > 0.10 triggers renormalisation. */
export const PLAY_TIME_TOLERANCE = 0.1

export interface PlayTimeEntry {
  /** Final minutes shown to the user (table value, or computed+renormalised+clamped). */
  minutes: number
  playerId: string
  /** Un-renormalised computed minutes; equals `minutes` when the table source is used. */
  rawMinutes: number
  source: PlayTimeSource
}

export interface PlayTimeComputation {
  /** measuredTotalMinutes / remainingTheoretical - 1 (0 when either side is 0). */
  deviationRatio: number
  entries: PlayTimeEntry[]
  /** Sum of the computed (non-table) raw minutes. 0 when nothing was computed. */
  measuredTotalMinutes: number
  /** Theoretical player-minutes left after table values were accounted for. */
  remainingTheoreticalMinutes: number
  renormalised: boolean
}

const FIVE_IN_EVENT = 'fiveIn'
const FIVE_OUT_EVENT = 'fiveOut'
const GAME_STOP_EVENT = 'gameStop'
const MILLISECONDS_PER_MINUTE = 60_000

/** Half-open time range `[start, end)` in epoch milliseconds. */
interface TimeInterval {
  end: number
  start: number
}

/** Collect the fiveIn/fiveOut stream per player, opponent and null ids excluded. */
function collectSubstitutions(stats: MatchStatLogEntry[]): Map<string, MatchStatLogEntry[]> {
  const substitutionsByPlayer = new Map<string, MatchStatLogEntry[]>()

  for (const entry of stats) {
    const isSubstitutionEvent = entry.name === FIVE_IN_EVENT || entry.name === FIVE_OUT_EVENT
    const isOwnPlayer = entry.playerId !== null && entry.playerId !== TEAM_OPPONENT_ID
    if (!(isSubstitutionEvent && isOwnPlayer) || entry.playerId === null) {
      continue
    }

    const playerEntries = substitutionsByPlayer.get(entry.playerId) ?? []
    playerEntries.push(entry)
    substitutionsByPlayer.set(entry.playerId, playerEntries)
  }

  for (const playerEntries of substitutionsByPlayer.values()) {
    playerEntries.sort((left, right) => left.timestamp - right.timestamp)
  }

  return substitutionsByPlayer
}

/**
 * Consecutive `gameStop` toggles delimit dead-ball windows (stop, then restart).
 *
 * Dead-ball time is excluded from playing time because the coach does not log a
 * substitution for a stoppage: a player "on court" across a window did not play.
 * A trailing unpaired `gameStop` is dropped: the match was stopped at the whistle.
 */
function collectDeadBallWindows(stats: MatchStatLogEntry[]): TimeInterval[] {
  const stopTimestamps = stats
    .filter((entry) => entry.name === GAME_STOP_EVENT)
    .map((entry) => entry.timestamp)
    .sort((left, right) => left - right)

  const windows: TimeInterval[] = []
  for (let index = 0; index + 1 < stopTimestamps.length; index += 2) {
    const start = stopTimestamps[index]
    const end = stopTimestamps[index + 1]
    if (start !== undefined && end !== undefined && end > start) {
      windows.push({ end, start })
    }
  }

  return windows
}

/**
 * Length of `[start, end]` after removing the dead-ball windows. Overlap is
 * clamped so the result is never negative nor inverted; a segment fully inside a
 * window yields 0.
 */
function liveMilliseconds(start: number, end: number, deadBallWindows: TimeInterval[]): number {
  let live = 0
  let cursor = start

  for (const window of deadBallWindows) {
    if (cursor >= end) {
      break
    }
    if (window.end <= cursor) {
      continue
    }
    live += Math.max(0, Math.min(window.start, end) - cursor)
    cursor = Math.max(cursor, window.end)
  }

  if (cursor < end) {
    live += end - cursor
  }

  return live
}

/**
 * Raw minutes from the union of on-court intervals.
 *
 * `eventEnd` is the last timestamp of the whole match: an interval still open at
 * the end of the stream is closed there, since the coach simply never logged the exit.
 */
function unionOnCourtMinutes(entries: MatchStatLogEntry[], eventEnd: number, deadBallWindows: TimeInterval[]): number {
  let openAt: number | null = null
  let totalMilliseconds = 0

  for (const entry of entries) {
    if (entry.name === FIVE_IN_EVENT) {
      // Double-IN: restart at the later entry; the dangling earlier interval contributes nothing.
      openAt = entry.timestamp
    } else if (openAt !== null) {
      totalMilliseconds += liveMilliseconds(openAt, entry.timestamp, deadBallWindows)
      openAt = null
    }
    // OUT-without-IN: `openAt` stays null, the orphan exit is ignored.
  }

  if (openAt !== null) {
    totalMilliseconds += liveMilliseconds(openAt, eventEnd, deadBallWindows)
  }

  return totalMilliseconds / MILLISECONDS_PER_MINUTE
}

/** Table values are valid only when finite and non-negative; anything else is treated as absent. */
function resolveTableMinutes(value: number | undefined, ceiling: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.min(value, ceiling)
}

function sumValues(values: Iterable<number>): number {
  let total = 0
  for (const value of values) {
    total += value
  }
  return total
}

function collectTableMinutes(
  playerIds: Set<string>,
  tablePlayTimes: Record<string, number>,
  ceilingMinutes: number
): Map<string, number> {
  const tableMinutesByPlayer = new Map<string, number>()

  for (const playerId of playerIds) {
    const tableMinutes = resolveTableMinutes(tablePlayTimes[playerId], ceilingMinutes)
    if (tableMinutes !== undefined) {
      tableMinutesByPlayer.set(playerId, tableMinutes)
    }
  }

  return tableMinutesByPlayer
}

function collectRawMinutes(
  playerIds: Set<string>,
  tableMinutesByPlayer: Map<string, number>,
  substitutionsByPlayer: Map<string, MatchStatLogEntry[]>,
  eventEnd: number,
  deadBallWindows: TimeInterval[]
): Map<string, number> {
  const rawMinutesByPlayer = new Map<string, number>()

  for (const playerId of playerIds) {
    const playerEntries = substitutionsByPlayer.get(playerId)
    if (playerEntries && !tableMinutesByPlayer.has(playerId)) {
      rawMinutesByPlayer.set(playerId, unionOnCourtMinutes(playerEntries, eventEnd, deadBallWindows))
    }
  }

  return rawMinutesByPlayer
}

interface EntryInput {
  ceilingMinutes: number
  measuredTotalMinutes: number
  playerIds: Set<string>
  rawMinutesByPlayer: Map<string, number>
  remainingTheoreticalMinutes: number
  renormalised: boolean
  tableMinutesByPlayer: Map<string, number>
}

function buildEntries(input: EntryInput): PlayTimeEntry[] {
  const entries: PlayTimeEntry[] = []

  for (const playerId of [...input.playerIds].sort()) {
    const tableMinutes = input.tableMinutesByPlayer.get(playerId)
    if (tableMinutes !== undefined) {
      entries.push({ minutes: tableMinutes, playerId, rawMinutes: tableMinutes, source: 'table' })
      continue
    }

    const rawMinutes = input.rawMinutesByPlayer.get(playerId)
    if (rawMinutes === undefined) {
      continue
    }

    // Renormalisation divides the UNCLAMPED raw values; the ceiling clamp runs last.
    const finalMinutes = input.renormalised
      ? (rawMinutes / input.measuredTotalMinutes) * input.remainingTheoreticalMinutes
      : rawMinutes
    entries.push({ minutes: Math.min(finalMinutes, input.ceilingMinutes), playerId, rawMinutes, source: 'computed' })
  }

  return entries
}

/**
 * Reconstruct playing time from the coach's fiveIn/fiveOut stream, preferring the
 * official match-sheet values when they exist. Pure: no store, no DOM, no Solid.
 */
export function computePlayTimes(
  match: Pick<MatchRawData, 'stats' | 'tablePlayTimes'>,
  format: MatchFormatConfig,
  options?: { tolerance?: number }
): PlayTimeComputation {
  const stats = match.stats ?? []
  const theoreticalMinutes = getTheoreticalPlayerMinutes(format)
  const ceilingMinutes = getMatchCeilingMinutes(format)
  const tolerance = options?.tolerance ?? PLAY_TIME_TOLERANCE
  const tablePlayTimes = match.tablePlayTimes ?? {}

  // Non-substitution events (gameStop, fouls...) still anchor the match window.
  // Seeded at 0 so an empty stream (a table-only match sheet) never indexes stats[0].
  const eventEnd = stats.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0)

  const substitutionsByPlayer = collectSubstitutions(stats)
  const deadBallWindows = collectDeadBallWindows(stats)
  const playerIds = new Set<string>([...substitutionsByPlayer.keys(), ...Object.keys(tablePlayTimes)])

  const tableMinutesByPlayer = collectTableMinutes(playerIds, tablePlayTimes, ceilingMinutes)
  const remainingTheoreticalMinutes = Math.max(0, theoreticalMinutes - sumValues(tableMinutesByPlayer.values()))

  const rawMinutesByPlayer = collectRawMinutes(
    playerIds,
    tableMinutesByPlayer,
    substitutionsByPlayer,
    eventEnd,
    deadBallWindows
  )
  const measuredTotalMinutes = sumValues(rawMinutesByPlayer.values())

  const canRenormalise = remainingTheoreticalMinutes > 0 && measuredTotalMinutes > 0
  const deviationRatio = canRenormalise ? measuredTotalMinutes / remainingTheoreticalMinutes - 1 : 0
  const renormalised = canRenormalise && Math.abs(deviationRatio) > tolerance

  return {
    deviationRatio,
    entries: buildEntries({
      ceilingMinutes,
      measuredTotalMinutes,
      playerIds,
      rawMinutesByPlayer,
      remainingTheoreticalMinutes,
      renormalised,
      tableMinutesByPlayer,
    }),
    measuredTotalMinutes,
    remainingTheoreticalMinutes,
    renormalised,
  }
}
