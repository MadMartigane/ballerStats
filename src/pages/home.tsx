import DarkThemeSwitch from '../components/dark-theme-switch'
import GlobalStats from '../components/global-stats'

export default function Home() {

  return (
    <div>
      <h3>Dashbord</h3>

      <div class="grid grid-cols-3 gap-4 content-start">
        <GlobalStats />

        <DarkThemeSwitch />
      </div>

    </div>
  )
}
