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

function handleExportEmails(team: Team) {
  const label = teamLabel(team)
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

  return (
    <>
      <BsTile
        footer={
          <>
            <button
              aria-label={`Exporter les emails de l'équipe ${teamLabel(team)}`}
              class="btn btn-square btn-secondary"
              onClick={() => handleExportEmails(team)}
              title="Exporter les emails"
              type="button"
            >
              <Mail />
            </button>
            <A
              aria-label={`Trombinoscope de l'équipe ${teamLabel(team)}`}
              class="btn btn-square btn-secondary"
              href={buildTeamTrombiPath(team.id)}
            >
              <LayoutGrid />
            </A>
            <Show when={props.onEdit}>
              <button
                class="btn btn-square btn-secondary"
                onClick={() => {
                  editTeam(team, props.onEdit)
                  scrollTop()
                }}
                type="button"
              >
                <UserPen />
              </button>
            </Show>
            <button
              class="btn btn-square btn-secondary"
              onClick={() => {
                removeTeam(team)
              }}
              type="button"
            >
              <Trash />
            </button>
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
                    <span class="p-1">{`${player.nicName || player.firstName} ${(player.nicName && '') || player.lastName}`}</span>
                  </p>
                )
              }
              return <p class="text-error">{`Joueur id ${id} introuvable`}</p>
            }}
          </For>
        </div>
      </BsTile>
    </>
  )
}
