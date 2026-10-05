import type { JSX } from 'solid-js'
import { createComponent } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it } from 'vitest'
import type { PlayTimeQuality, PlayTimeSourceQuality } from '../../libs/stats/play-time'
import type { ScoringKey, StatMatchSummary, StatMatchSummaryPlayer } from '../../libs/stats/stats.d'
import type { ResolvedMatchFormat } from '../../libs/team/match-format'
import {
  BsPlayTimeGauge,
  formatGapLabel,
  formatMinutes,
  formatQualityBadge,
  resolveQualityStatus,
  resolveSourceStatus,
} from './play-time-gauge'
import { BsPlayTimePanel } from './play-time-panel'

const SCORING_KEYS = ['2pts', '3pts', 'free-throw'] as const satisfies readonly ScoringKey[]

function makeSummaryPlayer(overrides: Partial<StatMatchSummaryPlayer> = {}): StatMatchSummaryPlayer {
  const ratio = Object.fromEntries(
    SCORING_KEYS.map((key) => [key, { fail: 0, percentage: 0, success: 0, total: 0 }])
  ) as StatMatchSummaryPlayer['ratio']

  return {
    assists: 0,
    astToRatio: 0,
    blocks: 0,
    eff: 0,
    fouls: 0,
    nbPlayedMatch: 1,
    playerId: 'p1',
    playTime: 20,
    ratio,
    rebonds: { defensive: 0, offensive: 0, total: 0 },
    scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 0 },
    steals: 0,
    trueShootingPercentage: 0,
    turnover: 0,
    ...overrides,
  }
}

function makeSummary(quality: PlayTimeQuality): StatMatchSummary {
  return {
    opponentFouls: 0,
    opponentScore: 0,
    players: [makeSummaryPlayer()],
    playTimeQuality: quality,
    rebonds: {
      opponentDefensive: 0,
      opponentOffensive: 0,
      opponentTotal: 0,
      teamDefensive: 0,
      teamDefensivePercentage: 0,
      teamOffensive: 0,
      teamOffensivePercentage: 0,
      teamTotal: 0,
      teamTotalPercentage: 0,
    },
    teamScore: 0,
    teamScores: makeSummaryPlayer(),
  }
}

const FORMAT: ResolvedMatchFormat = {
  periodLengthMinutes: 8,
  periods: 4,
  playersOnCourt: 5,
  source: 'default',
}

let disposeRender: (() => void) | undefined

// Every rendering test mounts into document.body, so one shared disposer keeps the suites isolated from each other.
function renderIntoBody(factory: () => JSX.Element): void {
  disposeRender = render(factory, document.body)
}

afterEach(() => {
  disposeRender?.()
  disposeRender = undefined
  document.body.innerHTML = ''
})

describe('resolveQualityStatus', () => {
  it('labels a quality of 95 percent or more as Excellent with the success tone', () => {
    expect(resolveQualityStatus(1)).toEqual({ label: 'Excellent', tone: 'success' })
    expect(resolveQualityStatus(0.95)).toEqual({ label: 'Excellent', tone: 'success' })
  })

  it('labels a quality between 80 and 95 percent as Bon with the success tone', () => {
    expect(resolveQualityStatus(0.94)).toEqual({ label: 'Bon', tone: 'success' })
    expect(resolveQualityStatus(0.8)).toEqual({ label: 'Bon', tone: 'success' })
    expect(resolveQualityStatus(0.81)).toEqual({ label: 'Bon', tone: 'success' })
  })

  it('labels a quality between 65 and 80 percent as Correcte with the warning tone', () => {
    expect(resolveQualityStatus(0.79)).toEqual({ label: 'Correcte', tone: 'warning' })
    expect(resolveQualityStatus(0.65)).toEqual({ label: 'Correcte', tone: 'warning' })
  })

  it('labels a quality between 50 and 65 percent as Médiocre with the warning tone', () => {
    expect(resolveQualityStatus(0.64)).toEqual({ label: 'Médiocre', tone: 'warning' })
    expect(resolveQualityStatus(0.5)).toEqual({ label: 'Médiocre', tone: 'warning' })
  })

  it('labels a quality below 50 percent as Mauvais with the error tone', () => {
    expect(resolveQualityStatus(0.49)).toEqual({ label: 'Mauvais', tone: 'error' })
    expect(resolveQualityStatus(0)).toEqual({ label: 'Mauvais', tone: 'error' })
  })

  it('keeps the five words ordered from the best score to the worst one', () => {
    const labels = [1, 0.8, 0.65, 0.5, 0].map((percentage) => resolveQualityStatus(percentage).label)

    expect(labels).toEqual(['Excellent', 'Bon', 'Correcte', 'Médiocre', 'Mauvais'])
  })

  it('reports a neutral Non calculée status when no percentage exists', () => {
    expect(resolveQualityStatus(null)).toEqual({ label: 'Non calculée', tone: 'neutral' })
  })
})

describe('resolveSourceStatus', () => {
  it('reports a neutral Non mesurée status when this source alone has no percentage', () => {
    expect(resolveSourceStatus(null)).toEqual({ label: 'Non mesurée', tone: 'neutral' })
  })

  it('delegates to the concordance wording when a percentage exists', () => {
    expect(resolveSourceStatus(0.9)).toEqual({ label: 'Bon', tone: 'success' })
    expect(resolveSourceStatus(0.6)).toEqual({ label: 'Médiocre', tone: 'warning' })
    expect(resolveSourceStatus(0.2)).toEqual({ label: 'Mauvais', tone: 'error' })
  })
})

describe('formatGapLabel', () => {
  it('renders a rounded whole gap percentage', () => {
    expect(formatGapLabel(0.0351)).toBe('4 %')
    expect(formatGapLabel(0.25)).toBe('25 %')
  })

  it('renders the dash when no gap exists', () => {
    expect(formatGapLabel(null)).toBe('—')
  })
})

describe('formatMinutes', () => {
  it('rounds minutes to a whole number with a min suffix', () => {
    expect(formatMinutes(163.49)).toBe('163 min')
    expect(formatMinutes(160)).toBe('160 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})

describe('formatQualityBadge', () => {
  it('renders a rounded whole score without a percent sign', () => {
    expect(formatQualityBadge(1)).toBe('100')
    expect(formatQualityBadge(0.5)).toBe('50')
    expect(formatQualityBadge(0)).toBe('0')
  })

  it('renders the dash when no percentage exists', () => {
    expect(formatQualityBadge(null)).toBe('—')
  })
})

describe('BsPlayTimeGauge rendering', () => {
  const measuredSource: PlayTimeSourceQuality = { gap: 0.02, percentage: 0.9, totalMinutes: 163 }

  it('renders the title, the status and the ring value for a measured source', () => {
    renderIntoBody(() =>
      createComponent(BsPlayTimeGauge, {
        dotClass: 'bg-primary',
        source: measuredSource,
        theoreticalMinutes: 160,
        title: 'Feuille officielle',
      })
    )

    const meter = document.querySelector('[role="meter"]')
    expect(document.body.textContent).toContain('Feuille officielle')
    expect(document.body.textContent).toContain('Bon')
    expect(meter?.getAttribute('aria-valuenow')).toBe('90')
    expect(meter?.getAttribute('aria-valuetext')).toBe('Bon : Score 90')
  })

  it('keeps the percent sign on the gap badge but not on the ring score', () => {
    renderIntoBody(() =>
      createComponent(BsPlayTimeGauge, {
        dotClass: 'bg-secondary',
        source: { gap: 0.02, percentage: 1, totalMinutes: 163 },
        theoreticalMinutes: 160,
        title: 'Suivi du coach',
      })
    )

    const meter = document.querySelector('[role="meter"]')
    expect(document.body.textContent).toContain('Écart à la cible : 2 %')
    expect(meter?.getAttribute('aria-valuetext')).toBe('Excellent : Score 100')
  })

  it('renders an empty ring and a Non mesurée label when the source is unmeasured', () => {
    const unmeasured: PlayTimeSourceQuality = { gap: null, percentage: null, totalMinutes: 0 }
    renderIntoBody(() =>
      createComponent(BsPlayTimeGauge, {
        dotClass: 'bg-primary',
        source: unmeasured,
        theoreticalMinutes: 160,
        title: 'Feuille officielle',
      })
    )

    const meter = document.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('0')
    expect(document.body.textContent).toContain('Non mesurée')
    // An unmeasured source must not show a fake measured zero for its total.
    expect(document.body.textContent).not.toContain('Total : 0 min')
    expect(document.body.textContent).toContain('Total : —')
  })
})

describe('BsPlayTimeGauge Score caption', () => {
  it('names the ring value on both rings of the panel', () => {
    const quality: PlayTimeQuality = {
      events: { gap: 0, percentage: 1, totalMinutes: 160 },
      gap: 0.05,
      percentage: 0.9,
      table: { gap: 0.05, percentage: 0.9, totalMinutes: 152 },
    }

    renderIntoBody(() => createComponent(BsPlayTimePanel, { format: FORMAT, summary: makeSummary(quality) }))

    const captions = [...document.querySelectorAll('[role="meter"]')].map((ring) => ring.querySelectorAll('span')[1])
    expect(captions).toHaveLength(2)
    expect(captions.map((caption) => caption?.textContent)).toEqual(['Score', 'Score'])
  })
})

describe('BsPlayTimePanel rendering', () => {
  it('renders both source titles and the two-source concordance line', () => {
    const quality: PlayTimeQuality = {
      events: { gap: 0, percentage: 1, totalMinutes: 160 },
      gap: 0.05,
      percentage: 0.9,
      table: { gap: 0.05, percentage: 0.9, totalMinutes: 152 },
    }

    renderIntoBody(() => createComponent(BsPlayTimePanel, { format: FORMAT, summary: makeSummary(quality) }))

    expect(document.body.textContent).toContain('Feuille officielle')
    expect(document.body.textContent).toContain('Suivi du coach')
    expect(document.body.textContent).toContain('Concordance des deux saisies')
    // The concordance badge is a bare score, so it cannot be confused with the gap percentages.
    const concordance = [...document.querySelectorAll('p')].find((node) =>
      node.textContent?.includes('Concordance des deux saisies')
    )
    expect(concordance?.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe('Concordance des deux saisies : 90')
    expect(document.querySelectorAll('[role="meter"]')).toHaveLength(2)
  })
})
