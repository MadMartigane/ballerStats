import { Shirt, Users } from 'lucide-solid'
import type { JSXElement } from 'solid-js'
import type Player from '../../libs/player/player'
import type { ScoringKey, StatMatchSummaryPlayer } from '../../libs/stats/stats.d'
import { isTeamPerGameRow, isTeamTotalRow } from '../../libs/stats/stats-util'

export type StatColumnId =
  | 'jersey'
  | 'name'
  | 'pts'
  | 'rebounds'
  | 'fouls'
  | 'turnover'
  | 'assists'
  | 'steals'
  | ScoringKey
  | 'blocks'
  | 'eff'
  | 'astTo'
  | 'tsPercent'

export interface StatGlossaryEntry {
  /** Detailed explanation shown in the modal. When absent, no "En savoir plus" button is rendered. */
  explanation?: string
  fullName: string
}

export interface StatColumn {
  glossary?: StatGlossaryEntry
  id: StatColumnId
  label: string
  renderCell: (stats: StatMatchSummaryPlayer, player?: Player | null) => JSXElement
  /** Override when the header is not plain text (e.g. icon). Default: `<th>{label}</th>`. */
  renderHeader?: () => JSXElement
}

export type ColumnWithGlossary = StatColumn & { glossary: StatGlossaryEntry }

const FALLBACK_JERSEY_ICON_SIZE = 28

function renderScoreCell(value: number | string) {
  return (
    <td>
      <span class="text-lg">{value}</span>
    </td>
  )
}

function renderRatioCell(key: ScoringKey, stats: StatMatchSummaryPlayer) {
  return (
    <td>
      <span class="text-lg">{`${stats.scores[key]}`}</span>
      {` ${stats.ratio[key].success}/${stats.ratio[key].total}`}
      <div>{`(${stats.ratio[key].percentage}%)`}</div>
    </td>
  )
}

const SCORING_COLUMN_META: Record<ScoringKey, { label: string; glossary?: StatGlossaryEntry }> = {
  '2pts': {
    label: '2pts',
  },
  '3pts': {
    label: '3pts',
  },
  'free-throw': {
    glossary: {
      explanation: 'Lancers francs réussis / tentés, avec le pourcentage de réussite.',
      fullName: 'Lancers Francs',
    },
    label: 'LF',
  },
}

// Iteration order must match column display order
const SCORING_KEYS = ['free-throw', '2pts', '3pts'] as const satisfies readonly ScoringKey[]

const TEAM_PER_GAME_LABEL = 'Équipe (par match)'
const TEAM_TOTAL_LABEL = 'Équipe (total)'
const TEAM_FALLBACK_LABEL = 'Équipe'

function resolveNameLabel(stats: StatMatchSummaryPlayer, player?: Player | null): string {
  if (isTeamPerGameRow(stats)) {
    return TEAM_PER_GAME_LABEL
  }
  if (isTeamTotalRow(stats)) {
    return TEAM_TOTAL_LABEL
  }
  return player?.nicName || player?.firstName || TEAM_FALLBACK_LABEL
}

export const STAT_COLUMNS: readonly StatColumn[] = [
  {
    id: 'jersey',
    label: 'Maillot',
    renderCell: (_stats, player) => (
      <td>
        <span class="text-2xl">{player?.jerseyNumber || <Users size={FALLBACK_JERSEY_ICON_SIZE} />}</span>
      </td>
    ),
    renderHeader: () => <Shirt />,
  },
  {
    id: 'name',
    label: 'Nom',
    renderCell: (stats, player) => <td class="text-xl">{resolveNameLabel(stats, player)}</td>,
  },
  {
    id: 'pts',
    label: 'Pts',
    renderCell: (stats) => renderScoreCell(stats.scores.total),
  },
  {
    glossary: {
      explanation: 'Nombre de rebonds capturés. Entre parenthèses : offensifs (O) et défensifs (D).',
      fullName: 'Rebonds (Offensifs-Défensifs)',
    },
    id: 'rebounds',
    label: 'Rbs (O-D)',
    renderCell: (stats) => (
      <td>
        <div class="text-lg">{stats.rebonds.total}</div>
        <span>{`(${stats.rebonds.offensive} - ${stats.rebonds.defensive})`}</span>
      </td>
    ),
  },
  {
    id: 'fouls',
    label: 'Fautes',
    renderCell: (stats) => renderScoreCell(stats.fouls),
  },
  {
    glossary: {
      explanation: 'Nombre de fois où le joueur a perdu la possession du ballon.',
      fullName: 'Turnovers / Balles Perdues',
    },
    id: 'turnover',
    label: 'TO',
    renderCell: (stats) => renderScoreCell(stats.turnover),
  },
  {
    glossary: {
      explanation: 'Nombre de passes ayant directement mené à un panier marqué.',
      fullName: 'Assists / Passes Décisives',
    },
    id: 'assists',
    label: 'Ass',
    renderCell: (stats) => renderScoreCell(stats.assists),
  },
  {
    glossary: {
      explanation:
        "Nombre de ballons volés à l'adversaire (interceptions). Inclut également les efforts francs provoquant une perte de balle — on parle de steals élargies.",
      fullName: 'Interceptions',
    },
    id: 'steals',
    label: 'Steals',
    renderCell: (stats) => renderScoreCell(stats.steals),
  },
  ...SCORING_KEYS.map<StatColumn>((key) => ({
    glossary: SCORING_COLUMN_META[key].glossary,
    id: key,
    label: SCORING_COLUMN_META[key].label,
    renderCell: (stats) => renderRatioCell(key, stats),
  })),
  {
    id: 'blocks',
    label: 'BLK',
    renderCell: (stats) => renderScoreCell(stats.blocks),
  },
  {
    glossary: {
      explanation:
        'Indice de performance global calculé à partir de toutes les statistiques. Formule simplifiée : (Pts + Rbs + Ass + Steals + BLK) − (Tirs ratés + TO). Exemple : un match à 15 pts, 8 rebonds, 3 passes sans perte de balle donne une EFF de 26.',
      fullName: 'Évaluation / Efficiency',
    },
    id: 'eff',
    label: 'EFF',
    renderCell: (stats) => renderScoreCell(stats.eff),
  },
  {
    glossary: {
      explanation: 'Rapport entre passes décisives et balles perdues. > 1 est bon, < 1 est mauvais.',
      fullName: 'Ratio Assists/Turnovers',
    },
    id: 'astTo',
    label: 'A/TO',
    renderCell: (stats) => renderScoreCell(stats.astToRatio.toFixed(1)),
  },
  {
    glossary: {
      explanation:
        'Pourcentage de réussite au tir pondéré. Contrairement au pourcentage classique, le TS% prend en compte la valeur des tirs (3pts > 2pts) et les lancers francs. Formule : Pts / (2 × (Tirs tentés + 0.44 × LF tentés)). Un TS% de 50% est considéré comme une bonne performance.',
      fullName: 'True Shooting %',
    },
    id: 'tsPercent',
    label: 'TS%',
    renderCell: (stats) => renderScoreCell(`${stats.trueShootingPercentage}%`),
  },
]

export const GLOSSARY_COLUMNS: readonly ColumnWithGlossary[] = STAT_COLUMNS.filter(
  (col): col is ColumnWithGlossary => col.glossary !== undefined
)
