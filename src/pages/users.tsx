import { Copy, Plus, Trash } from 'lucide-solid'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { canManageStaff, currentClub, currentUser, ROLE_LABELS } from '../libs/auth/auth'
import type { ClubMembersRecord, EnrichUser, InviteResponse, TeamRecord } from '../libs/auth/auth.d'
import { isAuthEnabled, pb } from '../libs/pocketbase/client'
import {
  buildStaffOptions,
  canManageShares,
  getTeamAccessLabel,
  groupSharesByTeam,
  isTeamAccess,
  TEAM_ACCESS_OPTIONS,
} from '../libs/team-sharing/team-sharing'
import type { TeamAccess, TeamMembersRecord } from '../libs/team-sharing/team-sharing.d'
import {
  createTeamShare,
  deleteTeamShare,
  listClubTeamShares,
  updateTeamShare,
} from '../libs/team-sharing/team-sharing-api'
import { confirmAction, toast } from '../libs/utils/utils'

export default function Users() {
  const [memberships, setMemberships] = createSignal<ClubMembersRecord[]>([])
  const [enrichedUsers, setEnrichedUsers] = createSignal<Record<string, EnrichUser>>({})
  const [teams, setTeams] = createSignal<TeamRecord[]>([])
  const [listError, setListError] = createSignal<string | null>(null)

  const [email, setEmail] = createSignal('')
  const [name, setName] = createSignal('')
  const [role, setRole] = createSignal<'staff' | 'admin'>('staff')
  const [teamId, setTeamId] = createSignal('')
  const [access, setAccess] = createSignal<'read' | 'write'>('read')
  const [inviting, setInviting] = createSignal(false)
  const [newInvite, setNewInvite] = createSignal<InviteResponse | null>(null)

  const [teamShares, setTeamShares] = createSignal<TeamMembersRecord[]>([])
  const [shareError, setShareError] = createSignal<string | null>(null)
  const [shareTeamId, setShareTeamId] = createSignal('')
  const [shareUserId, setShareUserId] = createSignal('')
  const [shareAccess, setShareAccess] = createSignal<TeamAccess>('read')
  const [shareBusy, setShareBusy] = createSignal(false)

  // Reloads members/teams whenever the session gains (or keeps) manager rights.
  createEffect(() => {
    if (canManageStaff()) {
      refreshMembers()
      if (canManageShares()) {
        loadTeamShares()
      }
    }
  })

  async function refreshMembers() {
    setListError(null)
    try {
      const list = await pb.collection<ClubMembersRecord>('club_members').getList(1, 200, { expand: 'club' })
      setMemberships(list.items)
      enrichMembers(list.items)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Impossible de charger les membres.')
    }
  }

  // users.viewRule blocks expanding user records, so names come from the enrich hook.
  async function enrichMembers(items: ClubMembersRecord[]) {
    const pendingIds = items.map((item) => item.user)
    if (pendingIds.length === 0) {
      return
    }
    try {
      const result = (await pb.send('/api/baller/users/enrich', { body: { ids: pendingIds }, method: 'POST' })) as {
        users: EnrichUser[]
      }
      const map: Record<string, EnrichUser> = {}
      for (const user of result.users) {
        map[user.id] = user
      }
      setEnrichedUsers(map)
    } catch {
      // enrich is best-effort: ids stay visible without the names
    }
  }

  async function loadTeamShares() {
    const clubId = currentClub.get()?.id
    if (!clubId) {
      return
    }
    setShareError(null)
    try {
      const { members, teams: clubTeams } = await listClubTeamShares(clubId)
      setTeams(clubTeams)
      setTeamShares(members)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Impossible de charger les partages.')
    }
  }

  async function handleInvite(event: SubmitEvent) {
    event.preventDefault()
    setInviting(true)
    setNewInvite(null)
    try {
      const response = (await pb.send('/api/baller/invite', {
        body: {
          access: access(),
          email: email(),
          name: name() || undefined,
          role: role(),
          teamId: teamId() || undefined,
        },
        method: 'POST',
      })) as InviteResponse
      setNewInvite(response)
      setEmail('')
      setName('')
      setTeamId('')
      toast('Invitation créée', 'success')
      refreshMembers()
      loadTeamShares()
    } catch (err) {
      toast(`Invitation impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 'error')
    } finally {
      setInviting(false)
    }
  }

  async function copyPassword() {
    const password = newInvite()?.password
    if (!password) {
      return
    }
    try {
      await navigator.clipboard.writeText(password)
      toast('Mot de passe copié', 'success')
    } catch {
      toast('Copie impossible', 'error')
    }
  }

  const handleEmailInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setEmail(event.currentTarget.value)
  }
  const handleNameInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setName(event.currentTarget.value)
  }
  const handleRoleInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    setRole(event.currentTarget.value as 'staff' | 'admin')
  }
  const handleTeamInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    setTeamId(event.currentTarget.value)
  }
  const handleAccessInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    setAccess(event.currentTarget.value as 'read' | 'write')
  }

  const shareViews = createMemo(() => groupSharesByTeam(teams(), teamShares(), enrichedUsers()))
  const staffOptions = createMemo(() => buildStaffOptions(memberships(), enrichedUsers()))
  const shareableUsers = createMemo(() => {
    const sharedUserIds = new Set(
      (shareViews().find((view) => view.teamId === shareTeamId())?.members ?? []).map((row) => row.userId)
    )
    return staffOptions().filter((staff) => !sharedUserIds.has(staff.userId))
  })

  const handleShareTeamInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    setShareTeamId(event.currentTarget.value)
  }
  const handleShareUserInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    setShareUserId(event.currentTarget.value)
  }
  const handleShareAccessInput = (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
    const { value } = event.currentTarget
    if (isTeamAccess(value)) {
      setShareAccess(value)
    }
  }

  async function handleAddShare(event: SubmitEvent) {
    event.preventDefault()
    const clubId = currentClub.get()?.id
    if (!clubId || !shareTeamId() || !shareUserId()) {
      return
    }
    setShareBusy(true)
    try {
      await createTeamShare(clubId, shareTeamId(), shareUserId(), shareAccess())
      toast('Accès partagé', 'success')
      await loadTeamShares()
      setShareUserId('')
    } catch (err) {
      toast(`Partage impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 'error')
    } finally {
      setShareBusy(false)
    }
  }

  async function handleShareAccessChange(recordId: string, newAccess: TeamAccess) {
    try {
      await updateTeamShare(recordId, newAccess)
      toast('Accès mis à jour', 'success')
      await loadTeamShares()
    } catch (err) {
      toast(`Mise à jour impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 'error')
    }
  }

  async function handleRevokeShare(recordId: string, userName: string) {
    const confirmed = await confirmAction('Révoquer le partage', `Retirer l'accès de ${userName} ?`)
    if (!confirmed) {
      return
    }
    try {
      await deleteTeamShare(recordId)
      toast('Partage révoqué', 'success')
      await loadTeamShares()
    } catch (err) {
      toast(`Révocation impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 'error')
    }
  }

  function makeShareAccessChangeHandler(recordId: string) {
    return (event: InputEvent & { currentTarget: HTMLSelectElement }) => {
      const { value } = event.currentTarget
      if (isTeamAccess(value)) {
        handleShareAccessChange(recordId, value)
      }
    }
  }

  function makeRevokeShareClickHandler(recordId: string, userName: string) {
    return () => {
      handleRevokeShare(recordId, userName)
    }
  }

  return (
    <div class="mx-auto mt-8 max-w-3xl space-y-8">
      <h1 class="font-bold text-2xl">Utilisateurs</h1>

      <Show when={!isAuthEnabled}>
        <p class="alert alert-warning" role="alert">
          La gestion des utilisateurs nécessite PocketBase.
        </p>
      </Show>

      <Show
        fallback={
          <p class="alert alert-info" role="alert">
            Cette page est réservée aux administrateurs du club.
          </p>
        }
        when={isAuthEnabled && canManageStaff()}
      >
        <section class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Inviter un membre du staff</h2>
            <form class="space-y-4" onsubmit={handleInvite}>
              <label class="form-control w-full">
                <span class="label">Email</span>
                <input
                  autocomplete="email"
                  class="input input-bordered w-full"
                  onInput={handleEmailInput}
                  required
                  type="email"
                  value={email()}
                />
              </label>

              <label class="form-control w-full">
                <span class="label">Nom (optionnel)</span>
                <input
                  autocomplete="name"
                  class="input input-bordered w-full"
                  onInput={handleNameInput}
                  type="text"
                  value={name()}
                />
              </label>

              <div class="flex flex-col gap-4 sm:flex-row">
                <label class="form-control w-full">
                  <span class="label">Rôle</span>
                  <select class="select select-bordered w-full" onInput={handleRoleInput} value={role()}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <Show when={teams().length > 0}>
                  <label class="form-control w-full">
                    <span class="label">Équipe (optionnel)</span>
                    <select class="select select-bordered w-full" onInput={handleTeamInput} value={teamId()}>
                      <option value="">Aucune</option>
                      <For each={teams()}>{(team) => <option value={team.id}>{team.name}</option>}</For>
                    </select>
                  </label>
                </Show>

                <Show when={teamId()}>
                  <label class="form-control w-full">
                    <span class="label">Accès</span>
                    <select class="select select-bordered w-full" onInput={handleAccessInput} value={access()}>
                      <For each={TEAM_ACCESS_OPTIONS}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </label>
                </Show>
              </div>

              <button class="btn btn-primary" disabled={inviting() || !email()} type="submit">
                <Plus />
                {inviting() ? 'Invitation…' : 'Inviter'}
              </button>
            </form>

            <Show when={newInvite()}>
              <div class="alert alert-success mt-4">
                <div class="w-full">
                  <p class="font-medium">Invitation créée pour {newInvite()?.email}</p>
                  <p class="mt-1 text-sm">Mot de passe à usage unique :</p>
                  <div class="mt-2 flex items-center gap-2">
                    <code class="rounded bg-base-100 px-3 py-1 font-bold font-mono text-lg">
                      {newInvite()?.password}
                    </code>
                    <button class="btn btn-sm btn-ghost" onClick={copyPassword} type="button">
                      <Copy />
                      Copier
                    </button>
                  </div>
                  <p class="mt-1 text-sm">Transmettez-le au membre — il ne sera plus affiché ensuite.</p>
                </div>
              </div>
            </Show>
          </div>
        </section>

        <section>
          <h2 class="font-bold text-xl">Membres du club ({memberships().length})</h2>

          <Show when={listError()}>
            <p class="alert alert-error mt-2" role="alert">
              {listError()}
            </p>
          </Show>

          <div class="mt-4 space-y-2">
            <For each={memberships()}>
              {(membership) => {
                const self = currentUser.get()
                const userInfo =
                  self && membership.user === self.id
                    ? ({ email: self.email, id: self.id, name: self.name } satisfies EnrichUser)
                    : enrichedUsers()[membership.user]
                return (
                  <div class="flex items-center justify-between rounded-md bg-base-200 px-4 py-2">
                    <div>
                      <p class="font-medium">{userInfo?.name ?? 'Membre'}</p>
                      <p class="text-neutral-500 text-sm">{userInfo?.email ?? membership.user}</p>
                    </div>
                    <span class="badge badge-outline">{ROLE_LABELS[membership.role]}</span>
                  </div>
                )
              }}
            </For>
          </div>
        </section>

        <section>
          <h2 class="font-bold text-xl">Partage des équipes</h2>

          <Show when={shareError()}>
            <p class="alert alert-error mt-2" role="alert">
              {shareError()}
            </p>
          </Show>

          <div class="card mt-4 bg-base-200">
            <div class="card-body">
              <h3 class="card-title">Ajouter un partage</h3>
              <form class="space-y-4" onsubmit={handleAddShare}>
                <div class="flex flex-col gap-4 sm:flex-row">
                  <label class="form-control w-full">
                    <span class="label">Équipe</span>
                    <select class="select select-bordered w-full" onInput={handleShareTeamInput} value={shareTeamId()}>
                      <option value="">Choisir une équipe</option>
                      <For each={teams()}>{(team) => <option value={team.id}>{team.name}</option>}</For>
                    </select>
                  </label>

                  <label class="form-control w-full">
                    <span class="label">Membre du staff</span>
                    <select
                      class="select select-bordered w-full"
                      disabled={!shareTeamId() || shareableUsers().length === 0}
                      onInput={handleShareUserInput}
                      value={shareUserId()}
                    >
                      <option value="">
                        {shareableUsers().length === 0 ? 'Aucun membre disponible' : 'Choisir un membre'}
                      </option>
                      <For each={shareableUsers()}>
                        {(staff) => <option value={staff.userId}>{staff.name ?? staff.email ?? staff.userId}</option>}
                      </For>
                    </select>
                  </label>

                  <label class="form-control w-full">
                    <span class="label">Accès</span>
                    <select
                      class="select select-bordered w-full"
                      onInput={handleShareAccessInput}
                      value={shareAccess()}
                    >
                      <For each={TEAM_ACCESS_OPTIONS}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </label>
                </div>

                <button
                  class="btn btn-primary"
                  disabled={shareBusy() || !shareTeamId() || !shareUserId()}
                  type="submit"
                >
                  <Plus />
                  {shareBusy() ? 'Ajout…' : "Partager l'accès"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section>
          <h2 class="font-bold text-xl">Partages par équipe</h2>

          <div class="mt-4 space-y-4">
            <For each={shareViews()}>
              {(view) => (
                <div class="rounded-md bg-base-200 p-4">
                  <h3 class="font-semibold">{view.teamName}</h3>
                  <Show
                    fallback={<p class="mt-2 text-sm italic opacity-70">Aucun accès partagé pour cette équipe.</p>}
                    when={view.members.length > 0}
                  >
                    <div class="mt-2 space-y-2">
                      <For each={view.members}>
                        {(member) => (
                          <div class="flex items-center justify-between gap-2 rounded-md bg-base-100 px-3 py-2">
                            <div class="min-w-0">
                              <p class="font-medium">{member.name ?? 'Membre'}</p>
                              <p class="text-neutral-500 text-sm">{member.email ?? member.userId}</p>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                              <span class="badge badge-outline">{getTeamAccessLabel(member.access)}</span>
                              <select
                                aria-label="Changer l'accès"
                                class="select select-bordered select-sm"
                                onInput={makeShareAccessChangeHandler(member.recordId)}
                                value={member.access}
                              >
                                <For each={TEAM_ACCESS_OPTIONS}>
                                  {(option) => <option value={option.value}>{option.label}</option>}
                                </For>
                              </select>
                              <div class="tooltip tooltip-top" data-tip="Révoquer l'accès">
                                <button
                                  aria-label="Révoquer l'accès"
                                  class="btn btn-square btn-ghost btn-sm"
                                  onClick={makeRevokeShareClickHandler(
                                    member.recordId,
                                    member.name ?? member.email ?? member.userId
                                  )}
                                  type="button"
                                >
                                  <Trash />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>
    </div>
  )
}
