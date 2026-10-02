import type { Game, GameSession, Member } from '../types.ts'

export type ManualSessionInput = { gameId: string; startedAt: string; durationMinutes: number; participantIds: string[]; note: string }

export function createManualSession(input: ManualSessionInput, games: Game[], crew: Member[], user: string, now = Date.now()): GameSession {
  const game = games.find(value => value.id === input.gameId)
  if (!game) throw new Error('Choose a game from the library.')
  const start = Date.parse(input.startedAt)
  if (!Number.isFinite(start)) throw new Error('Enter a valid date and start time.')
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440) throw new Error('Enter a duration between 1 minute and 24 hours.')
  const end = start + input.durationMinutes * 60000
  if (end > now) throw new Error('A past session must finish in the past. Check the start time and duration.')
  const participants = [...new Set(input.participantIds)].filter(id => crew.some(member => member.id === id))
  if (!participants.length) throw new Error('Choose at least one player.')
  if (input.note.length > 5000) throw new Error('Keep session notes under 5,000 characters.')
  const timestamp = new Date(now).toISOString()
  return { id: crypto.randomUUID(), gameId: game.id, gameTitle: game.title,
    startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), endReason: 'manual', recordedManually: true,
    pausedMilliseconds: 0, participantIds: participants, startedBy: user, startProgress: game.progress,
    note: input.note.trim(), createdAt: timestamp, updatedAt: timestamp }
}

export function localDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
