import type { Game, Member } from './types'

export const members: Member[] = []

export const initialGames: Game[] = []

export const statusLabels = {
  playing: 'Playing',
  'up-next': 'Up next',
  maybe: 'Maybe',
  wishlist: 'Wishlist',
  completed: 'Completed',
} as const
