import { Show } from 'solid-js'
import DarkThemeSwitch from '../components/dark-theme-switch'
import GlobalStats from '../components/global-stats'
import BsIconBasketballBall from '../components/icons/basketball-ball'
import BsIconPersonPlay from '../components/icons/person-play'
import BsIconBasketballBallPlain from '../components/icons/basketball-ball-plain'
import BsIconBasketballBallOutline from '../components/icons/basketball-ball-outline'
import BsIconBasketballPlayer from '../components/icons/basketball-player'
import BsIconBasketballPanel from '../components/icons/basketball-panel'
import BsIconBasketballBasketMove from '../components/icons/basketball-basket-move'
import { Loader, Medal, Share, Trash2 } from 'lucide-solid'
import orchestrator from '../libs/orchestrator/orchestrator'
import BsToggle from '../components/toggle'
import MadSignal from '../libs/mad-signal'

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

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
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
        >
          {bigCleanInProgress.get() ? (
            <Loader class="animate-spin" />
          ) : (
            <Trash2 />
          )}{' '}
          BIG CLEAN
        </button>

        <button
          class="btn btn-neutral"
          onClick={() => {
            orchestrator.exportDB()
          }}
        >
          <Share /> Sauvegarde DB
        </button>

        <BsToggle
          label="Afficher la démo"
          value={displayDemo.get()}
          onChange={value => {
            displayDemo.set(value)
          }}
        />
      </div>

      <Show when={displayDemo.get()}>
        <div class="py-4">
          <button class="btn">Default</button>
          <button class="btn btn-neutral">Neutral</button>
          <button class="btn btn-primary">Primary</button>
          <button class="btn btn-secondary">Secondary</button>
          <button class="btn btn-accent">Accent</button>
          <button class="btn btn-success">Success</button>
          <button class="btn btn-warning">Warning</button>
          <button class="btn btn-error">Error</button>
          <button class="btn btn-outline">Default</button>
          <button class="btn btn-outline btn-neutral">Neutral</button>
          <button class="btn btn-outline btn-primary">Primary</button>
          <button class="btn btn-outline btn-secondary">Secondary</button>
          <button class="btn btn-outline btn-accent">Accent</button>
          <button class="btn btn-outline btn-success">Success</button>
          <button class="btn btn-outline btn-warning">Warning</button>
          <button class="btn btn-outline btn-error">Error</button>

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
        </div>
      </Show>
    </div>
  )
}
