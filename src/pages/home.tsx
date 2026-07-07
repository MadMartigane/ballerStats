import { BellRing, Loader, Medal, Megaphone, Share, Trash2, Vibrate } from 'lucide-solid'
import { Show } from 'solid-js'
import DarkThemeSwitch from '../components/dark-theme-switch'
import GlobalStats from '../components/global-stats'
import BsIconBasketballBall from '../components/icons/basketball-ball'
import BsIconBasketballBallOutline from '../components/icons/basketball-ball-outline'
import BsIconBasketballBallPlain from '../components/icons/basketball-ball-plain'
import BsIconBasketballPanel from '../components/icons/basketball-panel'
import BsIconBasketballPlayer from '../components/icons/basketball-player'
import BsIconPersonPlay from '../components/icons/person-play'
import BsToggle from '../components/toggle'
import MadSignal from '../libs/mad-signal'
import orchestrator, { DB_FILE_EXTENSION } from '../libs/orchestrator/orchestrator'
import { toast } from '../libs/utils'
import { vibrate } from '../libs/vibrator'

const displayDemo = new MadSignal(false)
const bigCleanInProgress = new MadSignal(false)
const SHOWCASE_PERSON_PLAY_SIZE = 54
const SHOWCASE_PANEL_SIZE = 84
const SHOWCASE_MEDAL_SIZE = 96

export default function Home() {
  return (
    <div>
      <div class="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
        <div class="border border-box border-primary p-1">
          <GlobalStats />
        </div>

        <div class="border border-box border-primary p-1">
          <h2>Thème:</h2>
          <DarkThemeSwitch />
        </div>
      </div>

      <hr />

      <h2>Administration:</h2>

      <div class="grid grid-cols-2 content-start gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <button
          class="btn btn-accent"
          disabled={bigCleanInProgress.get()}
          onClick={() => {
            bigCleanInProgress.set(true)
            orchestrator.bigClean()
            setTimeout(() => {
              bigCleanInProgress.set(false)
            }, 400)
          }}
          type="button"
        >
          {bigCleanInProgress.get() ? <Loader class="animate-spin" /> : <Trash2 />} BIG CLEAN
        </button>

        <button
          class="btn btn-neutral"
          onClick={() => {
            orchestrator.exportDB()
          }}
          type="button"
        >
          <Share /> Sauvegarde DB
        </button>

        <label class="col-span-2" for="input-import-db">
          Restauration DB
          <input
            accept={DB_FILE_EXTENSION}
            class="file-input file-input-bordered w-full max-w-xs"
            id="input-import-db"
            onChange={(
              event: Event & {
                currentTarget: HTMLInputElement
                target: HTMLInputElement
              }
            ) => {
              orchestrator.importDB(event)
            }}
            type="file"
          />
        </label>

        <div class="col-span-2">
          <BsToggle
            label="Afficher la démo"
            onChange={(value) => {
              displayDemo.set(value)
            }}
            value={displayDemo.get()}
          />
        </div>
      </div>

      <Show when={displayDemo.get()}>
        <div class="py-4">
          <button class="btn" type="button">
            Default
          </button>
          <button class="btn btn-neutral" type="button">
            Neutral
          </button>
          <button class="btn btn-primary" type="button">
            Primary
          </button>
          <button class="btn btn-secondary" type="button">
            Secondary
          </button>
          <button class="btn btn-accent" type="button">
            Accent
          </button>
          <button class="btn btn-success" type="button">
            Success
          </button>
          <button class="btn btn-warning" type="button">
            Warning
          </button>
          <button class="btn btn-error" type="button">
            Error
          </button>
          <button class="btn btn-outline" type="button">
            Default
          </button>
          <button class="btn btn-outline btn-neutral" type="button">
            Neutral
          </button>
          <button class="btn btn-outline btn-primary" type="button">
            Primary
          </button>
          <button class="btn btn-outline btn-secondary" type="button">
            Secondary
          </button>
          <button class="btn btn-outline btn-accent" type="button">
            Accent
          </button>
          <button class="btn btn-outline btn-success" type="button">
            Success
          </button>
          <button class="btn btn-outline btn-warning" type="button">
            Warning
          </button>
          <button class="btn btn-outline btn-error" type="button">
            Error
          </button>

          <div class="flex flex-row gap-4 py-4">
            <BsIconBasketballBall class="text-secondary" />
            <BsIconPersonPlay size={SHOWCASE_PERSON_PLAY_SIZE} />
            <BsIconBasketballBallPlain />
            <BsIconBasketballBallOutline />
            <BsIconBasketballPlayer />
            <BsIconBasketballPanel class="text-primary" size={SHOWCASE_PANEL_SIZE} />
            <Medal size={SHOWCASE_MEDAL_SIZE} />
          </div>

          <div class="grid grid-cols-2 content-start gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <button
              class="btn btn-outline"
              onClick={() => {
                vibrate()
              }}
              type="button"
            >
              <Vibrate />
              Simple
            </button>
            <button
              class="btn btn-outline"
              onClick={() => {
                vibrate('double')
              }}
              type="button"
            >
              <Vibrate />
              Double
            </button>
            <button
              class="btn btn-outline"
              onClick={() => {
                vibrate('long')
              }}
              type="button"
            >
              <Vibrate />
              Long
            </button>
            <button
              class="btn btn-outline col-span-2"
              onClick={() => {
                orchestrator.throwUserActionFeedback()
              }}
              type="button"
            >
              <BellRing />
              Throw user feedback
            </button>
            <button
              class="btn btn-outline"
              onClick={() => {
                toast('Info test', 'info')
                toast('Success test', 'success')
                toast('Warning test', 'warning')
                toast('Error test', 'error')
              }}
              type="button"
            >
              <Megaphone />
              Toast !
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
