import { createSignal } from 'solid-js'
import { Icon } from '@suid/material'
import button from '../components/button'

export default function Home() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <h3>Home</h3>
      <p class="mt-4">This is the home page.</p>

      <div class="flex items-center space-x-2">
        {button({
          variant: 'success',
          element: (<Icon fontSize="large">remove</Icon>),
          onClick:() => setCount(count() - 1)
        })}

        <output class="p-10px">Count: {count()}</output>

        {button({
          element: (<Icon fontSize="large">add</Icon>),
          onClick:() => setCount(count() + 1)
        })}

      </div>
      <div class="flex items-center space-x-2 space-y-2">
        {button({
          variant: 'success',
          onClick: () => setCount(count() + 1),
          element: <span>success Count: {count()}</span>,
        })}

        {button({
          variant: 'warning',
          size: 'lg',
          onClick: () => setCount(count() -2),
          element: <span>warning lg Count: {count()}</span>,
        })}
 
        {button({
          variant: 'primary',
          size: 'sm',
          onClick: () => setCount(count() + 1),
          element: <span>primary sm Count: {count()}</span>,
        })}

        {button({
          variant: 'light',
          size: 'base',
          onClick: () => setCount(count() + 1),
          element: <span>light base Count: {count()}</span>,
        })}

        {button({
          variant: 'error',
          size: 'base',
          pills: true,
          onClick: () => setCount(count() + 1),
          element: <span>error base Count: {count()}</span>,
        })}

        {button({
          variant: 'secondary',
          size: 'base',
          wide: true,
          onClick: () => setCount(count() + 1),
          element: <span>secondary base Count: {count()}</span>,
        })}

      </div>
    </div>
  )
}
