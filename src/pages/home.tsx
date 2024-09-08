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
import { Medal, Trash2 } from 'lucide-solid'
import orchestrator from '../libs/orchestrator/orchestrator'

const displayDemo = true

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
      <Show when={displayDemo}>
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
          <button
            class="btn btn-warning btn-lg"
            onClick={() => {
              orchestrator.bigClean()
            }}
          >
            <Trash2 /> BIG CLEAN
          </button>
        </div>
      </Show>
    </div>
  )
}
