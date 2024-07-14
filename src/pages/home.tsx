import { createSignal } from 'solid-js'
import Button from '../components/button'
import { Minus, Plus } from 'lucide-solid'
import DarkThemeSwitch from '../components/dark-theme-switch'

export default function Home() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <h3>Home</h3>
      <p class="mt-4">This is the home page.</p>

      <DarkThemeSwitch />

      <div class="flex items-center space-x-2">
        {Button({
          variant: 'success',
          element: <Minus />,
          onClick: () => setCount(count() - 1),
        })}

        <output class="p-10px">Count: {count()}</output>

        <Button 
          element={<Plus />}
          onClick={() => setCount(count() + 1)}
        />
      </div>
    </div>
  )
}
