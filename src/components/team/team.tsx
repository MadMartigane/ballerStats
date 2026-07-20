import { A } from '@solidjs/router'
import { LayoutGrid, Mail, Trash, UserPen } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { collectTeamEmails, slugifyTeamName } from '../../libs/email-export/email-export'
import { buildTeamTrombiPath } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Team from '../../libs/team'
import { confirmAction, downloadBlob, scrollTop, toast } from '../../libs/utils'
import BsTile from '../tile'
import type { BsTeamProps } from './team.d'

async function removeTeam(team: Team) {
  const yes = await confirmAction()

  if (yes) {
    orchestrator.Teams.remove(team)
  }
}

function editTeam(team: Team, callback: (team: Team) => void) {
  callback(team)
}

function teamLabel(team: Team): string {
  return team.name || '(sans nom)'
}

function handleExportEmails(team: Team, label: string) {
  const emails = collectTeamEmails(team, orchestrator.Players.players, orchestrator.Contacts.contacts)
  if (emails.length === 0) {
    toast(`Aucun email à exporter pour l'équipe ${label}.`, 'warning')
    return
  }
  const content = `${emails.join('\n')}\n`
  const blob = new Blob([content], { type: 'text/plain' })
  const slug = slugifyTeamName(team.name)
  const fileName = slug ? `baller-stats-team-emails-${slug}.txt` : 'baller-stats-team-emails.txt'
  downloadBlob(blob, fileName)
  toast(`${emails.length} email(s) exporté(s) pour l'équipe ${label}.`, 'success')
}

export default function BsTeam(props: BsTeamProps) {
  const team = props.team
  const label = teamLabel(team)

  return (
    <BsTile
      footer={
        <>
          <div class="tooltip tooltip-top" data-tip={`Exporter les emails de l'équipe ${label}`}>
            <button
              aria-label={`Exporter les emails de l'équipe ${label}`}
              class="btn btn-square btn-secondary"
              onClick={() => handleExportEmails(team, label)}
              type="button"
            >
              <Mail />
            </button>
          </div>
          <div class="tooltip tooltip-top" data-tip={`Trombinoscope de l'équipe ${label}`}>
            <A
              aria-label={`Trombinoscope de l'équipe ${label}`}
              class="btn btn-square btn-secondary"
              href={buildTeamTrombiPath(team.id)}
            >
              <LayoutGrid />
            </A>
          </div>
          <Show when={props.onEdit}>
            <div class="tooltip tooltip-top" data-tip={`Modifier l'équipe ${label}`}>
              <button
                aria-label={`Modifier l'équipe ${label}`}
                class="btn btn-square btn-secondary"
                onClick={() => {
                  editTeam(team, props.onEdit)
                  scrollTop()
                }}
                type="button"
              >
                <UserPen />
              </button>
            </div>
          </Show>
          <div class="tooltip tooltip-top" data-tip={`Supprimer l'équipe ${label}`}>
            <button
              aria-label={`Supprimer l'équipe ${label}`}
              class="btn btn-square btn-secondary"
              onClick={() => {
                removeTeam(team)
              }}
              type="button"
            >
              <Trash />
            </button>
          </div>
        </>
      }
      info={`Nombre de joueurs : ${team.playerIds.filter((id) => orchestrator.getPlayer(id)).length}`}
      title={team.name || ''}
    >
      <div class="mt-4">
        <For each={team.playerIds}>
          {(id) => {
            const player = orchestrator.getPlayer(id)

            if (player) {
              return (
                <p class="">
                  <span class="inline-block w-8 text-right text-warning">{player.jerseyNumber}</span>
                  <span class="p-1">{`${player.nicName || player.firstName} ${player.lastName}`}</span>
                </p>
              )
            }
            return <p class="text-error">{`Joueur id ${id} introuvable`}</p>
          }}
        </For>
      </div>
    </BsTile>
  )
}
