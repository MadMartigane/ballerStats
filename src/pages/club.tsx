import { Building2, Save } from 'lucide-solid'
import { createEffect, createMemo, createSignal } from 'solid-js'
import BsCard from '../components/card/card'
import BsInput from '../components/input/input'
import { CLUB_LICENSE_MAX_LENGTH } from '../libs/club/club'
import { clubs } from '../libs/clubs-store'
import orchestrator from '../libs/orchestrator/orchestrator'
import { toast } from '../libs/utils/utils'

const CLUB_NAME_MAX_LENGTH = 50

export default function ClubSettingsPage() {
  const currentClub = createMemo(() => clubs[0])
  const [clubName, setClubName] = createSignal('')
  const [licenseNumber, setLicenseNumber] = createSignal('')

  createEffect(() => {
    const club = currentClub()
    if (club) {
      setClubName(club.name ?? '')
      setLicenseNumber(club.licenseNumber ?? '')
    }
  })

  function saveClub() {
    const club = currentClub()
    if (!club) {
      return
    }
    club.update({ licenseNumber: licenseNumber().trim(), name: clubName().trim() })
    orchestrator.Clubs.updateClub(club)
    toast('Club enregistré.', 'success')
  }

  return (
    <div>
      {BsCard({
        body: (
          <form class="flex flex-col gap-2">
            {BsInput({
              label: 'Nom du club',
              maxLength: CLUB_NAME_MAX_LENGTH,
              onChange: (value: string) => setClubName(value),
              placeholder: 'BCC Marseille',
              type: 'text',
              value: clubName(),
            })}
            {BsInput({
              label: 'Numéro de licence',
              maxLength: CLUB_LICENSE_MAX_LENGTH,
              onChange: (value: string) => setLicenseNumber(value),
              placeholder: '1310000000',
              type: 'text',
              value: licenseNumber(),
            })}
          </form>
        ),
        footer: (
          <div class="footer-buttons-container">
            <button class="btn btn-primary btn-wide" onClick={saveClub} type="button">
              <Save />
              Enregistrer
            </button>
          </div>
        ),
        info: 'Le nom du club s\u2019affiche sur le trombinoscope.',
        title: (
          <p class="flex flex-row gap-1">
            <Building2 />
            Réglages du club
          </p>
        ),
      })}
    </div>
  )
}
