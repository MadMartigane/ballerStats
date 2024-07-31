import DarkThemeSwitch from '../components/dark-theme-switch'
import GlobalStats from '../components/global-stats'

export default function Home() {

  return (
    <div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
        <GlobalStats />

        <DarkThemeSwitch />
      </div>

    </div>
  )
}
