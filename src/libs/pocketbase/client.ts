import PocketBase from 'pocketbase'

// Empty URL (production build without VITE_POCKETBASE_URL) disables auth UI.
export const isAuthEnabled = (import.meta.env.VITE_POCKETBASE_URL ?? '') !== ''

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? '')

// The UI fires several near-simultaneous requests (club_members + enrich after
// login); without this, the SDK would cancel the previous identical request.
pb.autoCancellation(false)
