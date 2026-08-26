export type GameStatus = 'playing' | 'up-next' | 'maybe' | 'wishlist' | 'completed'
export type Persona = 'Nern' | 'Jern' | 'Vern'
export type ContentType = 'game' | 'dlc'

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
  contentType?: ContentType
  parentGameId?: string
  parentGameTitle?: string
  completedAt?: string
}

export type Member = {
  id: string
  name: string
  initials: string
  color: string
  photoUrl?: string
  googlePhotoUrl?: string
  customPhotoUrl?: string
  persona?: Persona
}
