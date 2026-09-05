import { A } from '@solidjs/router'
import { LayoutGrid, Mail, Trash, UserPen } from 'lucide-solid'
import { For, Show } from 'solid-js'
import Contact from '../../libs/contact/contact'
import { collectTeamEmails, slugifyTeamName } from '../../libs/email-export/email-export'
import { buildTeamTrombiPath } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
import Player from '../../libs/player/player'
import { getRawContacts } from '../../libs/stores/contacts-store'
import { getRawPlayers } from '../../libs/stores/players-store'
import type Team from '../../libs/team/team'
import { confirmAction, downloadBlob, scrollTop, toast } from '../../libs/utils/utils'
import BsTile from '../tile/tile'
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
  const emails = collectTeamEmails(
    team,
    getRawPlayers().map((raw) => new Player(raw)),
    getRawContacts().map((raw) => new Contact(raw))
  )
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

function makeExportEmailsClickHandler(team: Team, label: string) {
  return () => {
    handleExportEmails(team, label)
  }
}

function makeEditTeamClickHandler(team: Team, onEdit: BsTeamProps['onEdit']) {
  return () => {
    editTeam(team, onEdit)
    scrollTop()
  }
}

function makeRemoveTeamClickHandler(team: Team) {
  return () => {
    removeTeam(team)
  }
}

export default function BsTeam(props: BsTeamProps) {
  const { team } = props
  const label = teamLabel(team)

  return (
    <BsTile
      footer={
        <>
          <div class="tooltip tooltip-top" data-tip={`Exporter les emails de l'équipe ${label}`}>
            <button
              aria-label={`Exporter les emails de l'équipe ${label}`}
              class="btn btn-square btn-secondary"
              onClick={makeExportEmailsClickHandler(team, label)}
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
                onClick={makeEditTeamClickHandler(team, props.onEdit)}
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
              onClick={makeRemoveTeamClickHandler(team)}
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
