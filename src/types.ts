export type GameStatus = 'playing' | 'up-next' | 'wishlist' | 'completed' | 'archived'
export type Persona = 'Nern' | 'Jern' | 'Vern'
export type ContentType = 'game' | 'dlc'
export type SteamLinkPreference = 'auto' | 'app' | 'browser'

export type GameNightResponse = {
  status: 'accepted' | 'declined'
  respondedAt: string
  suggestedStartAt?: string
  suggestedEndAt?: string
  googleEventId?: string
  calendarSyncedAt?: string
  responseVersion?: number
  calendarVersion?: number
}

export type GameNight = {
  id: string
  title: string
  gameId?: string
  gameTitle?: string
  startAt: string
  endAt: string
  note?: string
  createdBy: string
  createdAt: string
  responses: Record<string, GameNightResponse>
  version?: number
}

export type GameSession = {
  id: string
  gameId: string
  gameTitle: string
  startedAt: string
  endedAt?: string
  pausedAt?: string
  pausedMilliseconds: number
  participantIds: string[]
  startedBy: string
  startProgress: number
  endProgress?: number
  recap?: string
  nextObjective?: string
  createdAt: string
  updatedAt: string
}

export type ActivitySnapshot = Game | GameNight | GameSession

export type ActivityChange = {
  entity: 'game' | 'game-night' | 'session'
  entityId: string
  before?: ActivitySnapshot
  after?: ActivitySnapshot
}

export type ActivityUndo = {
  changes: ActivityChange[]
}

export type ActivityEntry = {
  id: string
  actorId: string
  actorName: string
  action: string
  summary: string
  createdAt: string
  undo?: ActivityUndo
  undoneAt?: string
  undoneBy?: string
}

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

export type PuzzleImage = {
  id: string
  name: string
  dataUrl: string
  x: number
  y: number
  width: number
  height: number
  cropX: number
  cropY: number
  cropZoom: number
}

export type PuzzlePage = {
  id: string
  title: string
  note: string
  strokes: PuzzleStroke[]
  images: PuzzleImage[]
}

export type PuzzleBoard = {
  pages: PuzzlePage[]
  updatedBy: string
}

export type GameLink = {
  id: string
  label: string
  url: string
  addedBy: string
  createdAt: string
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
  manualOwnership?: Record<string, boolean>
  isFree?: boolean
  links?: GameLink[]
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
  steamLinkPreference?: SteamLinkPreference
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

export type Recommendation = {
  steamAppId: string
  title: string
  year?: number
  genres: string[]
  summary: string
  why: string
  onlineCoopMax: number
  reviewSummary: string
  positivePercent: number
  totalReviews: number
  coverUrl: string
  headerUrl: string
  steamUrl: string
  isFree?: boolean
}

export type RecommendationFeed = {
  editionDate: string
  generatedAt: string
  minimumReviews: number
  minimumOnlinePlayers: number
  recommendations: Recommendation[]
}

export type RecommendationFeedback = Record<string, {
  title: string
  downvotes: string[]
  excludedAt?: string
}>
