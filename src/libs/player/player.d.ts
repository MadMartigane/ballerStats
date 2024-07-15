export type PlayerRawData = {
  id?: number
  firstName?: string
  lastName?: string
  jersayNumber?: string // We have to make the diff between 00 and 0, 01 and 1, etc.
  licenseNumber?: string
  nicName?: string
  birthDay?: number // timestamp
  // TODO: id photo
}
