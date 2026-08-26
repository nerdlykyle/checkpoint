export type GameStatus = 'playing' | 'up-next' | 'maybe' | 'wishlist' | 'completed'
export type Persona = 'Nern' | 'Jern' | 'Vern'

export type Game = {
  id: string
  title: string
  year?: number
  status: GameStatus
  progress: number
  note: string
  votes: string[]
  color: string
  accent: string
  platform: string
  addedBy: string
  hours?: number
  genre?: string
  coverMark: string
  coverUrl?: string
  steamAppId?: string
  catalogId?: string
  catalogSource?: 'steam'
  completedAt?: string
}

export type Member = {
  id: string
  name: string
  initials: string
  color: string
  photoUrl?: string
  persona?: Persona
}
