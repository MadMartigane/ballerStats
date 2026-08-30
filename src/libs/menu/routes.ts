export const ROUTE_PLAYERS = '/players'
export const ROUTE_TEAMS = '/teams'
export const ROUTE_TROMBI = '/trombi'
export const ROUTE_TROMBI_TEAM = '/trombi/:teamId'
export const ROUTE_CLUB = '/club'

export const buildTeamTrombiPath = (teamId: string): string => ROUTE_TROMBI_TEAM.replace(':teamId', teamId)
