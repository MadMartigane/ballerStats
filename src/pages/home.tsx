import { createSignal } from 'solid-js'
import { Button, Box, Icon, Typography } from '@suid/material'

export default function Home() {
  const [count, setCount] = createSignal(0)

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Home
      </Typography>
      <p class="mt-4">This is the home page.</p>

      <div class="flex items-center space-x-2">
        <Button
          color="success"
          variant="contained"
          onClick={() => setCount(count() - 1)}
        >
          <Icon fontSize="large">remove</Icon>
        </Button>

        <output class="p-10px">Count: {count()}</output>

        <Button variant="contained" onClick={() => setCount(count() + 1)}>
          <Icon fontSize="large">add</Icon>
        </Button>
      </div>
    </Box>
  )
}
