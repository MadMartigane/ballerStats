import type PocketBase from 'pocketbase'
import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import { fromContactRecord, fromMatchRecord, fromPlayerRecord, fromTeamRecord } from './mapper'
import type { RemoteRecord, SyncCollection } from './sync.d'

export type RawRecord = PlayerRawData | TeamRawData | MatchRawData | ContactRawData

export interface PulledCollection {
  collection: SyncCollection
  raws: RawRecord[]
  records: RemoteRecord[]
}

const FROM_RECORD: Record<SyncCollection, (record: RemoteRecord) => RawRecord> = {
  contacts: fromContactRecord,
  matchs: fromMatchRecord,
  players: fromPlayerRecord,
  teams: fromTeamRecord,
}

/** Fetches every record of a collection owned by the club (tombstones included). */
export async function pullCollection(
  pb: PocketBase,
  collection: SyncCollection,
  clubId: string
): Promise<PulledCollection> {
  const records = (await pb.collection(collection).getFullList({
    filter: pb.filter('club = {:club}', { club: clubId }),
  })) as unknown as RemoteRecord[]
  return {
    collection,
    raws: records.map((record) => FROM_RECORD[collection](record)),
    records,
  }
}
