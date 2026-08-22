export interface PlayerRawData {
  birthDay?: number // timestamp
  email?: string // player's direct email address (optional)
  firstName?: string
  hasPhoto?: boolean
  id?: string
  jerseyNumber?: string // We have to make the diff between 00 and 0, 01 and 1, etc.
  lastName?: string
  licenseNumber?: string
  nicName?: string
  phone?: string // player's direct phone number (optional — parents are primary contacts)
}
