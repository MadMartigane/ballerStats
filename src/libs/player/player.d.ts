export type PlayerRawData = {
  id?: string
  firstName?: string
  lastName?: string
  jerseyNumber?: string // We have to make the diff between 00 and 0, 01 and 1, etc.
  licenseNumber?: string
  nicName?: string
  birthDay?: number // timestamp
  hasPhoto?: boolean
  phone?: string // player's direct phone number (optional — parents are primary contacts)
  email?: string // player's direct email address (optional)
}
