import { Shirt, Users } from 'lucide-solid'
import type { JSXElement } from 'solid-js'
import type Player from '../../libs/player'
import type { ScoringKey, StatMatchSummaryPlayer } from '../../libs/stats'

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
  explanation: string
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

const SCORING_COLUMN_META = {
  'free-throw': {
    label: 'LF',
    glossary: {
      fullName: 'Lancers Francs',
      explanation: 'Lancers francs réussis / tentés, avec le pourcentage de réussite.',
    },
  },
  '2pts': {
    label: '2pts',
    glossary: {
      fullName: 'Tirs à 2 points',
      explanation: 'Tirs à 2 points réussis / tentés, avec le pourcentage de réussite.',
    },
  },
  '3pts': {
    label: '3pts',
    glossary: {
      fullName: 'Tirs à 3 points',
      explanation: 'Tirs à 3 points réussis / tentés, avec le pourcentage de réussite.',
    },
  },
} satisfies Record<ScoringKey, { label: string; glossary: StatGlossaryEntry }>

// Iteration order must match column display order
const SCORING_KEYS = ['free-throw', '2pts', '3pts'] as const satisfies readonly ScoringKey[]

export const STAT_COLUMNS: readonly StatColumn[] = [
  {
    id: 'jersey',
    label: 'Maillot',
    renderHeader: () => <Shirt />,
    renderCell: (_stats, player) => (
      <td>
        <span class="text-2xl">{player?.jerseyNumber || <Users size={FALLBACK_JERSEY_ICON_SIZE} />}</span>
      </td>
    ),
  },
  {
    id: 'name',
    label: 'Nom',
    renderCell: (_stats, player) => <td class="text-xl">{player?.nicName || player?.firstName || 'Équipe'}</td>,
    glossary: {
      fullName: 'Nom du joueur',
      explanation: 'Nom ou surnom du joueur. Pour la ligne équipe, affiche « Équipe ».',
    },
  },
  {
    id: 'pts',
    label: 'Pts',
    renderCell: (stats) => renderScoreCell(stats.scores.total),
    glossary: {
      fullName: 'Points',
      explanation: 'Nombre total de points marqués.',
    },
  },
  {
    id: 'rebounds',
    label: 'Rbs (O-D)',
    renderCell: (stats) => (
      <td>
        <div class="text-lg">{stats.rebonds.total}</div>
        <span>{`(${stats.rebonds.offensive} - ${stats.rebonds.defensive})`}</span>
      </td>
    ),
    glossary: {
      fullName: 'Rebonds (Offensifs-Défensifs)',
      explanation: 'Nombre de rebonds capturés. Entre parenthèses : offensifs (O) et défensifs (D).',
    },
  },
  {
    id: 'fouls',
    label: 'Fautes',
    renderCell: (stats) => renderScoreCell(stats.fouls),
    glossary: {
      fullName: 'Fautes',
      explanation: 'Nombre de fautes commises.',
    },
  },
  {
    id: 'turnover',
    label: 'TO',
    renderCell: (stats) => renderScoreCell(stats.turnover),
    glossary: {
      fullName: 'Turnovers / Balles Perdues',
      explanation: 'Nombre de fois où le joueur a perdu la possession du ballon.',
    },
  },
  {
    id: 'assists',
    label: 'Ass',
    renderCell: (stats) => renderScoreCell(stats.assists),
    glossary: {
      fullName: 'Assists / Passes Décisives',
      explanation: 'Nombre de passes ayant directement mené à un panier marqué.',
    },
  },
  {
    id: 'steals',
    label: 'Steals',
    renderCell: (stats) => renderScoreCell(stats.steals),
    glossary: {
      fullName: 'Interceptions',
      explanation: "Nombre de ballons volés à l'adversaire.",
    },
  },
  ...SCORING_KEYS.map<StatColumn>((key) => ({
    id: key,
    label: SCORING_COLUMN_META[key].label,
    renderCell: (stats) => renderRatioCell(key, stats),
    glossary: SCORING_COLUMN_META[key].glossary,
  })),
  {
    id: 'blocks',
    label: 'BLK',
    renderCell: (stats) => renderScoreCell(stats.blocks),
    glossary: {
      fullName: 'Blocks / Contres',
      explanation: 'Nombre de tirs adverses contrés.',
    },
  },
  {
    id: 'eff',
    label: 'EFF',
    renderCell: (stats) => renderScoreCell(stats.eff),
    glossary: {
      fullName: 'Évaluation / Efficiency',
      explanation: 'Indice de performance global calculé à partir de toutes les statistiques.',
    },
  },
  {
    id: 'astTo',
    label: 'A/TO',
    renderCell: (stats) => renderScoreCell(stats.astToRatio.toFixed(1)),
    glossary: {
      fullName: 'Ratio Assists/Turnovers',
      explanation: 'Rapport entre passes décisives et balles perdues. > 1 est bon, < 1 est mauvais.',
    },
  },
  {
    id: 'tsPercent',
    label: 'TS%',
    renderCell: (stats) => renderScoreCell(`${stats.trueShootingPercentage}%`),
    glossary: {
      fullName: 'True Shooting %',
      explanation: 'Pourcentage de réussite au tir pondéré (prend en compte 2pts, 3pts et lancers francs).',
    },
  },
]

export const GLOSSARY_COLUMNS: readonly ColumnWithGlossary[] = STAT_COLUMNS.filter(
  (col): col is ColumnWithGlossary => col.glossary != null
)
