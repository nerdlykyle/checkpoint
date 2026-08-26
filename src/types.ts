export type GameStatus = 'playing' | 'up-next' | 'maybe' | 'wishlist' | 'completed'
export type Persona = 'Nern' | 'Jern' | 'Vern'
export type ContentType = 'game' | 'dlc'

export type PuzzlePoint = {
  x: number
  y: number
}

export type PuzzleStroke = {
  id: string
  color: string
  width: number
  points: PuzzlePoint[]
  authorId: string
}

export type PuzzleBoard = {
  imageDataUrl: string
  imageName: string
  note: string
  strokes: PuzzleStroke[]
  updatedBy: string
}

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
  steamId?: string
  steamName?: string
  steamProfileUrl?: string
  steamAvatarUrl?: string
}

export type SteamOwnership = {
  owned: boolean
  playtimeMinutes: number
  lastPlayedAt?: number
}

export type SteamPlayerSnapshot = {
  steamId: string
  name: string
  avatarUrl: string
  profileUrl: string
  currentGameAppId?: string
  currentGameName?: string
}

export type SteamCrewSnapshot = {
  players: SteamPlayerSnapshot[]
  ownership: Record<string, Record<string, SteamOwnership>>
  privateSteamIds: string[]
  updatedAt: string
}

export type SteamAchievementSnapshot = {
  steamId: string
  unlocked: number
  total: number
}

export type GameDeal = {
  steamAppId: string
  title: string
  price: number
  retailPrice: number
  savingsPercent: number
  storeName: string
  dealUrl: string
  historicalLow?: number
  updatedAt: string
}
