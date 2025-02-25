import { BellRing, Loader, Medal, Megaphone, Share, Trash2, Vibrate } from 'lucide-solid'
import { Show } from 'solid-js'
import DarkThemeSwitch from '../components/dark-theme-switch'
import GlobalStats from '../components/global-stats'
import BsIconBasketballBall from '../components/icons/basketball-ball'
import BsIconBasketballBallOutline from '../components/icons/basketball-ball-outline'
import BsIconBasketballBallPlain from '../components/icons/basketball-ball-plain'
import BsIconBasketballBasketMove from '../components/icons/basketball-basket-move'
import BsIconBasketballPanel from '../components/icons/basketball-panel'
import BsIconBasketballPlayer from '../components/icons/basketball-player'
import BsIconPersonPlay from '../components/icons/person-play'
import BsToggle from '../components/toggle'
import MadSignal from '../libs/mad-signal'
import orchestrator from '../libs/orchestrator/orchestrator'
import { toast } from '../libs/utils'
import { vibrate } from '../libs/vibrator'

const displayDemo = new MadSignal(false)
const bigCleanInProgress = new MadSignal(false)

export default function Home() {
  return (
    <div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
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

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start">
        <button
          type="button"
          class="btn btn-accent"
          disabled={bigCleanInProgress.get()}
          onClick={() => {
            bigCleanInProgress.set(true)
            orchestrator.bigClean()
            setTimeout(() => {
              bigCleanInProgress.set(false)
            }, 400)
          }}
        >
          {bigCleanInProgress.get() ? <Loader class="animate-spin" /> : <Trash2 />} BIG CLEAN
        </button>

        <button
          type="button"
          class="btn btn-neutral"
          onClick={() => {
            orchestrator.exportDB()
          }}
        >
          <Share /> Sauvegarde DB
        </button>

        <label for="input-import-db" class="col-span-2">
          Restauration DB
          <input
            type="file"
            class="file-input file-input-bordered w-full max-w-xs"
            id="input-import-db"
            accept="application/json"
            onChange={(
              event: Event & {
                currentTarget: HTMLInputElement
                target: HTMLInputElement
              },
            ) => {
              orchestrator.importDB(event)
            }}
          />
        </label>

        <div class="col-span-2">
          <BsToggle
            label="Afficher la démo"
            value={displayDemo.get()}
            onChange={(value) => {
              displayDemo.set(value)
            }}
          />
        </div>
      </div>

      <Show when={displayDemo.get()}>
        <div class="py-4">
          <button type="button" class="btn">
            Default
          </button>
          <button type="button" class="btn btn-neutral">
            Neutral
          </button>
          <button type="button" class="btn btn-primary">
            Primary
          </button>
          <button type="button" class="btn btn-secondary">
            Secondary
          </button>
          <button type="button" class="btn btn-accent">
            Accent
          </button>
          <button type="button" class="btn btn-success">
            Success
          </button>
          <button type="button" class="btn btn-warning">
            Warning
          </button>
          <button type="button" class="btn btn-error">
            Error
          </button>
          <button type="button" class="btn btn-outline">
            Default
          </button>
          <button type="button" class="btn btn-outline btn-neutral">
            Neutral
          </button>
          <button type="button" class="btn btn-outline btn-primary">
            Primary
          </button>
          <button type="button" class="btn btn-outline btn-secondary">
            Secondary
          </button>
          <button type="button" class="btn btn-outline btn-accent">
            Accent
          </button>
          <button type="button" class="btn btn-outline btn-success">
            Success
          </button>
          <button type="button" class="btn btn-outline btn-warning">
            Warning
          </button>
          <button type="button" class="btn btn-outline btn-error">
            Error
          </button>

          <div class="flex flex-row gap-4 py-4">
            <BsIconBasketballBall variant="secondary" />
            <BsIconPersonPlay size="4xl" />
            <BsIconBasketballBallPlain />
            <BsIconBasketballBallOutline />
            <BsIconBasketballPlayer />
            <BsIconBasketballPanel size="9xl" variant="primary" />
            <BsIconBasketballBasketMove size="6xl" variant="accent" />
            <Medal size={96} />
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start">
            <button
              type="button"
              class="btn btn-outline"
              onClick={() => {
                vibrate()
              }}
            >
              <Vibrate />
              Simple
            </button>
            <button
              type="button"
              class="btn btn-outline"
              onClick={() => {
                vibrate('double')
              }}
            >
              <Vibrate />
              Double
            </button>
            <button
              type="button"
              class="btn btn-outline"
              onClick={() => {
                vibrate('long')
              }}
            >
              <Vibrate />
              Long
            </button>
            <button
              type="button"
              class="btn btn-outline col-span-2"
              onClick={() => {
                orchestrator.throwUserActionFeedback()
              }}
            >
              <BellRing />
              Throw user feedback
            </button>
            <button
              type="button"
              class="btn btn-outline"
              onClick={() => {
                toast('Info test', 'info')
                toast('Success test', 'success')
                toast('Warning test', 'warning')
                toast('Error test', 'error')
              }}
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
