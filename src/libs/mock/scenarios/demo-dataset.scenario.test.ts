import { beforeEach, describe, expect, it } from 'vitest'
import { getStatSummary } from '../../stats/stats-util'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { seedDemoDataset, TEAM_A_STAR_ID } from './demo-dataset.scenario'
import {
  BLOWOUT_LOSS_PROFILES,
  BLOWOUT_WIN_PROFILES,
  CLOSE_WIN_PROFILES,
  profilePoints,
  TARGET_BLOWOUT_LOSS,
  TARGET_BLOWOUT_WIN,
  TARGET_CLOSE_WIN,
} from './match-profiles'

describe('seedDemoDataset', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('returns the expected counts', () => {
    const ds = seedDemoDataset()
    expect(ds.teams).toHaveLength(2)
    expect(ds.players).toHaveLength(10)
    expect(ds.matchs).toHaveLength(4)
    expect(ds.contacts).toHaveLength(2)
  })

  it('every entity is registerable', () => {
    const ds = seedDemoDataset()
    for (const p of ds.players) {
      expect(p.isRegisterable).toBe(true)
    }
    for (const t of ds.teams) {
      expect(t.isRegisterable).toBe(true)
    }
    for (const m of ds.matchs) {
      expect(m.isRegisterable).toBe(true)
    }
    for (const c of ds.contacts) {
      expect(c.isRegisterable).toBe(true)
    }
  })

  it('is deterministic across calls after resetMockCounters()', () => {
    resetMockCounters()
    const a = seedDemoDataset().players.map((p) => p.id)
    resetMockCounters()
    const b = seedDemoDataset().players.map((p) => p.id)
    expect(a).toEqual(b)
  })

  it('finished matches produce the expected varied scores and margins', () => {
    const ds = seedDemoDataset()
    // matchs[0..2] are the 3 finished (locked) games; matchs[3] is the in-progress partial.
    const close = getStatSummary(ds.matchs[0])
    const win = getStatSummary(ds.matchs[1])
    const loss = getStatSummary(ds.matchs[2])

    expect(close.teamScore).toBe(TARGET_CLOSE_WIN.team)
    expect(close.opponentScore).toBe(TARGET_CLOSE_WIN.opponent)

    expect(win.teamScore).toBe(TARGET_BLOWOUT_WIN.team)
    expect(win.opponentScore).toBe(TARGET_BLOWOUT_WIN.opponent)

    expect(loss.teamScore).toBe(TARGET_BLOWOUT_LOSS.team)
    expect(loss.opponentScore).toBe(TARGET_BLOWOUT_LOSS.opponent)

    // Variety: not all the same margin
    const margins = [close, win, loss].map((m) => m.teamScore - m.opponentScore)
    expect(new Set(margins).size).toBe(3)
  })

  it('team A Marius (TEAM_A_STAR_ID) is the top scorer across finished games', () => {
    const ds = seedDemoDataset()
    const totalsByPlayer = new Map<string, number>()
    for (const m of ds.matchs.slice(0, 3)) {
      for (const p of getStatSummary(m).players) {
        totalsByPlayer.set(p.playerId, (totalsByPlayer.get(p.playerId) ?? 0) + p.scores.total)
      }
    }
    const marius = totalsByPlayer.get(TEAM_A_STAR_ID) ?? 0
    for (const [pid, total] of totalsByPlayer) {
      if (pid !== TEAM_A_STAR_ID) {
        expect(marius).toBeGreaterThan(total)
      }
    }
    expect(marius).toBe(
      profilePoints(CLOSE_WIN_PROFILES[0]) +
        profilePoints(BLOWOUT_WIN_PROFILES[0]) +
        profilePoints(BLOWOUT_LOSS_PROFILES[0])
    )
  })
})
