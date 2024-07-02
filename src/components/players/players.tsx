import { Box, Typography } from '@suid/material'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayers from '../../libs/players'

export default class BsPlayersEl {
  private players: MadSignal<BsPlayers> = new MadSignal(orchestrator.players)

  constructor() {
    this.installEventListener()
  }

  private onPlayersChange() {
    this.players.set(orchestrator.players)
  }

  private installEventListener() {
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
      this.onPlayersChange()
    })
  }

  public render() {
    return (
      <Box>
        <Typography variant="h3" gutterBottom>
          Home
        </Typography>
      </Box>
    )
  }
}
