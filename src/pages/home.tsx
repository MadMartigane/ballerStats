import { createSignal } from 'solid-js'
import { Box, Icon, Typography } from '@suid/material'
import { CODE_SNIPPET_TYPE } from '@carbon/web-components/es/components/code-snippet/defs.js'

export default function Home() {
  const [count, setCount] = createSignal(0)

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Home
      </Typography>
      <p class="mt-4">This is the home page.</p>

      <div class="flex items-center space-x-2">
        <cds-button
          size="xl"
          onClick={(): void => {
            setCount(count() - 1)
          }}
        >
          <Icon fontSize="large">remove</Icon>
        </cds-button>

        <output class="p-10px">Count: {count()}</output>

        <cds-button variant="contained" onClick={() => setCount(count() + 1)}>
          <Icon fontSize="large">add</Icon>
        </cds-button>

        <cds-code-snippet type={CODE_SNIPPET_TYPE.MULTI}>
          <span>
            node -v Lorem ipsum dolor sit amet, consectetur adipisicing elit.
            Blanditiis, veritatis voluptate id incidunt molestiae officia
            possimus, quasi itaque alias, architecto hic, dicta fugit? Debitis
            delectus quidem explicabo vitae laboriosam!
          </span>
        </cds-code-snippet>
      </div>
    </Box>
  )
}
