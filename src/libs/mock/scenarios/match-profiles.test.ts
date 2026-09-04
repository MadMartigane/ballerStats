import { describe, expect, it } from 'vitest'
import {
  BLOWOUT_LOSS_OPPONENT,
  BLOWOUT_LOSS_PROFILES,
  BLOWOUT_WIN_OPPONENT,
  BLOWOUT_WIN_PROFILES,
  CLOSE_WIN_OPPONENT,
  CLOSE_WIN_PROFILES,
  profilePoints,
  teamPoints,
} from './match-profiles'

describe('match-profiles arithmetic', () => {
  it('points decrease from star to weak within each game', () => {
    for (const profiles of [CLOSE_WIN_PROFILES, BLOWOUT_WIN_PROFILES, BLOWOUT_LOSS_PROFILES]) {
      const pts = profiles.map(profilePoints)
      for (let i = 0; i < pts.length - 1; i += 1) {
        expect(pts[i]).toBeGreaterThan(pts[i + 1])
      }
    }
  })

  it('close win: 78-75', () => {
    expect(teamPoints(CLOSE_WIN_PROFILES)).toBe(78)
    expect(profilePoints(CLOSE_WIN_OPPONENT)).toBe(75)
  })

  it('blowout win: 88-55', () => {
    expect(teamPoints(BLOWOUT_WIN_PROFILES)).toBe(88)
    expect(profilePoints(BLOWOUT_WIN_OPPONENT)).toBe(55)
  })

  it('blowout loss: 60-80', () => {
    expect(teamPoints(BLOWOUT_LOSS_PROFILES)).toBe(60)
    expect(profilePoints(BLOWOUT_LOSS_OPPONENT)).toBe(80)
  })
})
