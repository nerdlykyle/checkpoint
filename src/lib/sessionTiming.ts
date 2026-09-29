import type { GameSession } from '../types.ts'

export const SESSION_LIMIT_MS = 5 * 60 * 60 * 1000

// A wall-clock deadline survives closed tabs and includes time spent paused.
export function sessionDeadline(session: GameSession) {
  return Date.parse(session.startedAt) + SESSION_LIMIT_MS
}

export function sessionHasExpired(session: GameSession, now = Date.now()) {
  return !session.endedAt && now >= sessionDeadline(session)
}

export function stopGameSession(session: GameSession, now = Date.now()): GameSession {
  if (session.endedAt) return session
  const deadline = sessionDeadline(session)
  const end = Math.max(Date.parse(session.startedAt), Math.min(now, deadline))
  const pausedMilliseconds = (session.pausedMilliseconds || 0)
    + (session.pausedAt ? Math.max(0, end - Date.parse(session.pausedAt)) : 0)
  return {
    ...session,
    endedAt: new Date(end).toISOString(),
    endReason: now >= deadline ? 'time-limit' : 'manual',
    pausedAt: undefined,
    pausedMilliseconds,
    updatedAt: new Date(now).toISOString(),
  }
}

export function expireGameSessions(sessions: GameSession[], now = Date.now()) {
  if (!sessions.some((session) => sessionHasExpired(session, now))) return sessions
  return sessions.map((session) => sessionHasExpired(session, now) ? stopGameSession(session, now) : session)
}

export function sessionElapsedMilliseconds(session: GameSession, now = Date.now()) {
  // Preserve completed history; only unfinished timers get the new safety cap.
  const end = session.endedAt ? Date.parse(session.endedAt) : Math.min(now, sessionDeadline(session))
  const currentPause = session.pausedAt && !session.endedAt ? Math.max(0, end - Date.parse(session.pausedAt)) : 0
  return Math.max(0, end - Date.parse(session.startedAt) - (session.pausedMilliseconds || 0) - currentPause)
}
