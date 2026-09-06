import { createStore, reconcile } from 'solid-js/store'
import type { ClubRawData } from '../club/club.d'
import { storeClubs } from '../store/store'

export function assertClubAddable(existingClubs: ClubRawData[], newClub: ClubRawData): void {
  if (!newClub.name) {
    throw new Error(`[Clubs.add()] The club id ${newClub.id ?? ''} is not registerable, Please complete the data.`)
  }
  const alreadyRegistered = existingClubs.some((current) => current.id === newClub.id)
  if (alreadyRegistered) {
    throw new Error(`[Clubs.add()] The club id ${newClub.id} already exist, Please use .updateClub() method instead.`)
  }
}

export function assertClubExists(existingClubs: ClubRawData[], clubOrId: ClubRawData | string): ClubRawData {
  const id = typeof clubOrId === 'string' ? clubOrId : clubOrId.id
  const club = existingClubs.find((candidate) => candidate.id === id)
  if (!club) {
    throw new Error(`[Clubs] The club id ${id} doesn't exist.`)
  }
  return club
}

const [clubs, setClubs] = createStore<ClubRawData[]>([])

export { clubs }

export function getRawClubs(): ClubRawData[] {
  return clubs.map((raw) => ({ ...raw }))
}

export function getClubById(id: string): ClubRawData | null {
  const raw = clubs.find((candidate) => candidate.id === id)
  return raw ? { ...raw } : null
}

function cloneRaws(raws: ClubRawData[]): ClubRawData[] {
  return raws.map((raw) => ({ ...raw }))
}

function persistClubs(): void {
  storeClubs(getRawClubs()).catch((error: unknown) => {
    console.error('storeClubs failed:', error)
  })
}

/** Load or import a full collection: reconciles the reactive contents without ever persisting. */
export function hydrateClubs(raws: ClubRawData[]): void {
  setClubs(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replace the whole collection and persist exactly once (imports, demo seed, big clean). */
export function replaceAllClubs(raws: ClubRawData[]): void {
  setClubs(reconcile(cloneRaws(raws), { key: 'id' }))
  persistClubs()
}

export function addClub(raw: ClubRawData): void {
  const next = getRawClubs()
  assertClubAddable(next, raw)
  setClubs([...next, { ...raw }])
  persistClubs()
}

export function updateClub(id: string, raw: ClubRawData): void {
  assertClubExists(clubs, id)
  const index = clubs.findIndex((candidate) => candidate.id === id)
  setClubs(index, { ...raw })
  persistClubs()
}

export function removeClub(clubOrId: ClubRawData | string): void {
  assertClubExists(clubs, clubOrId)
  const id = typeof clubOrId === 'string' ? clubOrId : clubOrId.id
  setClubs((current) => current.filter((candidate) => candidate.id !== id))
  persistClubs()
}
