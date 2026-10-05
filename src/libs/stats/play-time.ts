import type { MatchRawData, MatchStatLogEntry } from '../match/match.d'
import type { MatchFormatConfig } from '../team/match-format'
import { getMatchCeilingMinutes, getTheoreticalPlayerMinutes } from '../team/match-format'
import { TEAM_OPPONENT_ID } from '../team/team'

export type PlayTimeSource = 'table' | 'computed' | 'blended'

/**
 * Weight of the official match-sheet minutes when the data gives no preference: either source
 * is unmeasured, or both sources score zero. The live weight comes from `computePlayTimeWeight`,
 * clamped between the floor and the ceiling below.
 */
export const PLAY_TIME_TABLE_WEIGHT = 0.6
/** Lower bound of the data-driven sheet weight. */
export const PLAY_TIME_WEIGHT_FLOOR = 0.3
/** Upper bound of the data-driven sheet weight. */
export const PLAY_TIME_WEIGHT_CEILING = 0.7
/** Relative source-vs-theoretical gap still scored at full quality. */
const QUALITY_FLAT_GAP = 0.03
/** Relative source-vs-theoretical gap where quality reaches zero. */
const QUALITY_ZERO_GAP = 0.25

export interface PlayTimeEntry {
  /** Final minutes shown to the user (blended, or computed+renormalised+clamped). */
  minutes: number
  playerId: string
  /** Un-renormalised source minutes; equals `minutes` when renormalisation is off. */
  rawMinutes: number
  source: PlayTimeSource
}

/** Concordance of one measured source against the theoretical total. */
export interface PlayTimeSourceQuality {
  /** |source total − theoretical| / theoretical; null when either sum is 0. */
  gap: number | null
  /** Fraction 0–1 from the quality curve; null when `gap` is null. */
  percentage: number | null
  /** Raw source sum, unclamped. */
  totalMinutes: number
}

export interface PlayTimeQuality {
  /** Event stream measured against the theoretical total. */
  events: PlayTimeSourceQuality
  /** |Σsheet − Σevents| / theoretical; null when either sum is 0. */
  gap: number | null
  /** Fraction 0–1; null when gap is null. */
  percentage: number | null
  /** Raw sheet sum measured against the theoretical total. */
  table: PlayTimeSourceQuality
}

export interface PlayTimeComputation {
  /** Σevents / theoretical - 1; 0 when no event was measured or the theoretical total is 0. */
  deviationRatio: number
  entries: PlayTimeEntry[]
  quality: PlayTimeQuality
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

/** Table value below the ceiling, or invalid; `raw` keeps the unclamped sheet value. */
interface ResolvedTableMinutes {
  minutes: number
  raw: number
}

/** Table values are valid only when finite and non-negative; anything else is treated as absent. */
function resolveTableMinutes(value: number | undefined, ceiling: number): ResolvedTableMinutes | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return { minutes: Math.min(value, ceiling), raw: value }
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
): Map<string, ResolvedTableMinutes> {
  const tableMinutesByPlayer = new Map<string, ResolvedTableMinutes>()

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
  substitutionsByPlayer: Map<string, MatchStatLogEntry[]>,
  eventEnd: number,
  deadBallWindows: TimeInterval[]
): Map<string, number> {
  const rawMinutesByPlayer = new Map<string, number>()

  for (const playerId of playerIds) {
    const playerEntries = substitutionsByPlayer.get(playerId)
    if (playerEntries) {
      rawMinutesByPlayer.set(playerId, unionOnCourtMinutes(playerEntries, eventEnd, deadBallWindows))
    }
  }

  return rawMinutesByPlayer
}

/** Quality curve: 1 while the gap is flat, then a linear descent to 0 at the zero gap. */
export function scorePlayTimeGap(gap: number): number {
  if (gap <= QUALITY_FLAT_GAP) {
    return 1
  }
  return Math.max(0, (QUALITY_ZERO_GAP - gap) / (QUALITY_ZERO_GAP - QUALITY_FLAT_GAP))
}

/** Concordance of one source: null gap/score when the source or the theoretical total is empty. */
function scoreSource(totalMinutes: number, theoreticalMinutes: number): PlayTimeSourceQuality {
  if (totalMinutes <= 0 || theoreticalMinutes <= 0) {
    return { gap: null, percentage: null, totalMinutes }
  }
  const gap = Math.abs(totalMinutes - theoreticalMinutes) / theoreticalMinutes
  return { gap, percentage: scorePlayTimeGap(gap), totalMinutes }
}

/** Full quality block from the three measured totals: the two per-source scores plus the sheet-vs-events gap. */
function buildQuality(eventsTotal: number, tableTotal: number, theoreticalMinutes: number): PlayTimeQuality {
  const hasBothSources = tableTotal > 0 && eventsTotal > 0
  const gap = hasBothSources && theoreticalMinutes > 0 ? Math.abs(tableTotal - eventsTotal) / theoreticalMinutes : null

  return {
    events: scoreSource(eventsTotal, theoreticalMinutes),
    gap,
    percentage: gap === null ? null : scorePlayTimeGap(gap),
    table: scoreSource(tableTotal, theoreticalMinutes),
  }
}

/**
 * Data-driven sheet weight: the sheet's share of the combined source concordance, clamped to
 * `[PLAY_TIME_WEIGHT_FLOOR, PLAY_TIME_WEIGHT_CEILING]`. When neither source carries a score the
 * measurement gives no preference, so the historical `PLAY_TIME_TABLE_WEIGHT` stands.
 */
export function computePlayTimeWeight(quality: PlayTimeQuality): number {
  // Load-bearing invariant: `?? 0` treats an unmeasured source as scored zero, which would
  // distort a blend if it could pair with a measured other source. It cannot: an unmeasured
  // source means its total is 0, so no blended entry exists for it and `tableWeight` only
  // reaches `blendMinutes` through blended players, whose both sources are measured. Should
  // `tableWeight` ever be applied outside a blend numerator (e.g. to rescale events-only or
  // sheet-only entries), this substitution must become an explicit branch on the null scores.
  const tableScore = quality.table.percentage ?? 0
  const eventsScore = quality.events.percentage ?? 0
  if (tableScore + eventsScore <= 0) {
    return PLAY_TIME_TABLE_WEIGHT
  }
  return Math.min(PLAY_TIME_WEIGHT_CEILING, Math.max(PLAY_TIME_WEIGHT_FLOOR, tableScore / (tableScore + eventsScore)))
}

interface EntryInput {
  ceilingMinutes: number
  renormalisationFactor: number
  /** Sheet share of the blend, from `computePlayTimeWeight`. */
  tableWeight: number
}

/** Both sources measured the player; the entry blends them. */
interface BlendedPlayerMinutes {
  eventsMinutes: number
  kind: 'blended'
  tableMinutes: ResolvedTableMinutes
}

/** Only the events measured the player; the entry is computed. */
interface EventsOnlyPlayerMinutes {
  eventsMinutes: number
  kind: 'eventsOnly'
}

/** Only the sheet measured the player; the entry is the sheet value and is never rescaled. */
interface SheetOnlyPlayerMinutes {
  kind: 'sheetOnly'
  tableMinutes: ResolvedTableMinutes
}

/** A player's measured sources, discriminated by `kind`; classified once in `collectPlayerMinutes`. */
type PlayerMinutes = BlendedPlayerMinutes | EventsOnlyPlayerMinutes | SheetOnlyPlayerMinutes

/** Blend weight applied to the sheet value when both sources measured the player. */
function blendMinutes(tableMinutes: number, eventsMinutes: number, tableWeight: number): number {
  return tableWeight * tableMinutes + (1 - tableWeight) * eventsMinutes
}

/** Merge both sources into one map keyed by player, sorted for a stable entry order. */
function collectPlayerMinutes(
  playerIds: Set<string>,
  tableMinutesByPlayer: Map<string, ResolvedTableMinutes>,
  rawMinutesByPlayer: Map<string, number>
): Map<string, PlayerMinutes> {
  const playerMinutes = new Map<string, PlayerMinutes>()

  for (const playerId of [...playerIds].sort()) {
    const tableMinutes = tableMinutesByPlayer.get(playerId)
    const eventsMinutes = rawMinutesByPlayer.get(playerId)

    if (tableMinutes !== undefined && eventsMinutes !== undefined) {
      playerMinutes.set(playerId, { eventsMinutes, kind: 'blended', tableMinutes })
    } else if (tableMinutes !== undefined) {
      playerMinutes.set(playerId, { kind: 'sheetOnly', tableMinutes })
    } else if (eventsMinutes !== undefined) {
      playerMinutes.set(playerId, { eventsMinutes, kind: 'eventsOnly' })
    }
  }

  return playerMinutes
}

/** Minutes a player contributes to the renormalisable blend; sheet-only players contribute nothing here. */
function blendableMinutesOf(minutes: PlayerMinutes, tableWeight: number): number {
  if (minutes.kind === 'sheetOnly') {
    return 0
  }
  return minutes.kind === 'blended'
    ? blendMinutes(minutes.tableMinutes.minutes, minutes.eventsMinutes, tableWeight)
    : minutes.eventsMinutes
}

function buildEntries(playerMinutes: Map<string, PlayerMinutes>, input: EntryInput): PlayTimeEntry[] {
  const entries: PlayTimeEntry[] = []

  for (const [playerId, minutes] of playerMinutes) {
    if (minutes.kind === 'sheetOnly') {
      // A sheet-only player is a measured record: renormalisation never rescales it.
      entries.push({
        minutes: minutes.tableMinutes.minutes,
        playerId,
        rawMinutes: minutes.tableMinutes.minutes,
        source: 'table',
      })
      continue
    }

    if (minutes.kind === 'blended') {
      const blendedMinutes = blendMinutes(minutes.tableMinutes.minutes, minutes.eventsMinutes, input.tableWeight)
      // Renormalisation scales the UNCLAMPED blend; the ceiling clamp runs last.
      entries.push({
        minutes: Math.min(blendedMinutes * input.renormalisationFactor, input.ceilingMinutes),
        playerId,
        rawMinutes: blendedMinutes,
        source: 'blended',
      })
      continue
    }

    entries.push({
      minutes: Math.min(minutes.eventsMinutes * input.renormalisationFactor, input.ceilingMinutes),
      playerId,
      rawMinutes: minutes.eventsMinutes,
      source: 'computed',
    })
  }

  return entries
}

/** Every measured quantity for a match, collected once and shared by the two public entry points. */
interface PlayTimeModel {
  blendableMinutes: number
  ceilingMinutes: number
  eventsTotal: number
  playerMinutes: Map<string, PlayerMinutes>
  quality: PlayTimeQuality
  remainingTheoreticalMinutes: number
  tableWeight: number
  theoreticalMinutes: number
}

/**
 * Collect the per-player source classification, the reference totals and the quality-derived
 * blend weight for a match: the single internal code path behind `computePlayTimes`.
 */
function buildPlayTimeModel(
  match: Pick<MatchRawData, 'stats' | 'tablePlayTimes'>,
  format: MatchFormatConfig
): PlayTimeModel {
  const stats = match.stats ?? []
  const theoreticalMinutes = getTheoreticalPlayerMinutes(format)
  const ceilingMinutes = getMatchCeilingMinutes(format)
  const tablePlayTimes = match.tablePlayTimes ?? {}

  // Non-substitution events (gameStop, fouls...) still anchor the match window.
  // Seeded at 0 so an empty stream (a table-only match sheet) never indexes stats[0].
  const eventEnd = stats.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0)

  const substitutionsByPlayer = collectSubstitutions(stats)
  const deadBallWindows = collectDeadBallWindows(stats)
  const playerIds = new Set<string>([...substitutionsByPlayer.keys(), ...Object.keys(tablePlayTimes)])

  const tableMinutesByPlayer = collectTableMinutes(playerIds, tablePlayTimes, ceilingMinutes)
  const rawMinutesByPlayer = collectRawMinutes(playerIds, substitutionsByPlayer, eventEnd, deadBallWindows)
  const playerMinutes = collectPlayerMinutes(playerIds, tableMinutesByPlayer, rawMinutesByPlayer)

  const eventsTotal = sumValues(rawMinutesByPlayer.values())
  // The quality block reads the RAW unclamped sheet sum: an over-ceiling sheet entry must lower
  // the table score rather than be hidden by a clamp.
  const tableTotal = sumValues([...tableMinutesByPlayer.values()].map((entry) => entry.raw))
  const quality = buildQuality(eventsTotal, tableTotal, theoreticalMinutes)
  const tableWeight = computePlayTimeWeight(quality)

  // Sheet-only players are excluded from the renormalisation denominator: they are
  // already-measured records and are never rescaled, so the measured part targets only
  // the minutes the sheet leaves free (theoretical − Σ_sheetOnly). Counting them in the
  // denominator would shrink the measured players to absorb a correction they do not own.
  let sheetOnlyMinutes = 0
  let blendableMinutes = 0
  for (const minutes of playerMinutes.values()) {
    if (minutes.kind === 'sheetOnly') {
      sheetOnlyMinutes += minutes.tableMinutes.minutes
    } else {
      blendableMinutes += blendableMinutesOf(minutes, tableWeight)
    }
  }

  return {
    blendableMinutes,
    ceilingMinutes,
    eventsTotal,
    playerMinutes,
    quality,
    remainingTheoreticalMinutes: Math.max(0, theoreticalMinutes - sheetOnlyMinutes),
    tableWeight,
    theoreticalMinutes,
  }
}

/**
 * Reconstruct playing time from the coach's fiveIn/fiveOut stream, blending the
 * official match-sheet minutes with the events. Pure: no store, no DOM, no Solid.
 */
export function computePlayTimes(
  match: Pick<MatchRawData, 'stats' | 'tablePlayTimes'>,
  format: MatchFormatConfig
): PlayTimeComputation {
  const model = buildPlayTimeModel(match, format)

  // Report the event-side deviation: on a sheet-only match it is 0, and an empty match has no
  // measurement at all, so its deviation is 0 rather than a meaningless -1.
  const deviationRatio =
    model.eventsTotal > 0 && model.theoreticalMinutes > 0 ? model.eventsTotal / model.theoreticalMinutes - 1 : 0
  // Renormalisation is systematic: a small-but-real gap from the theoretical total is exactly
  // what smoothing exists to correct, and the old tolerance dead-band let a 2 % gap survive
  // unaligned. It stands down only when no event was measured (a sheet-only match must never be
  // projected onto the theoretical total) or when the sheet left no budget to target.
  const renormalised = model.eventsTotal > 0 && model.remainingTheoreticalMinutes > 0
  const renormalisationFactor =
    renormalised && model.blendableMinutes > 0 ? model.remainingTheoreticalMinutes / model.blendableMinutes : 1

  return {
    deviationRatio,
    entries: buildEntries(model.playerMinutes, {
      ceilingMinutes: model.ceilingMinutes,
      renormalisationFactor,
      tableWeight: model.tableWeight,
    }),
    quality: model.quality,
    renormalised,
  }
}
