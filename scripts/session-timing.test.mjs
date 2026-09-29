import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SESSION_LIMIT_MS, expireGameSessions, sessionElapsedMilliseconds, sessionHasExpired, stopGameSession } from '../src/lib/sessionTiming.ts'

const start = Date.parse('2026-09-01T18:00:00Z')
const hour = 60 * 60 * 1000
const at = (milliseconds) => new Date(start + milliseconds).toISOString()
const session = (extra = {}) => ({
  id: 'test', gameId: 'game', gameTitle: 'Test game', startedAt: at(0),
  pausedMilliseconds: 0, participantIds: ['nern'], startedBy: 'nern',
  startProgress: 0, note: 'Keep these notes', createdAt: at(0), updatedAt: at(0), ...extra,
})

test('a session expires exactly five hours after its manual start', () => {
  const current = session()
  assert.equal(sessionHasExpired(current, start + SESSION_LIMIT_MS - 1), false)
  assert.equal(sessionHasExpired(current, start + SESSION_LIMIT_MS), true)
  assert.equal(sessionElapsedMilliseconds(current, start + 696 * hour), 5 * hour)
  const [stopped] = expireGameSessions([current], start + 696 * hour)
  assert.equal(stopped.endedAt, at(5 * hour))
  assert.equal(stopped.endReason, 'time-limit')
  assert.equal(stopped.note, current.note)
  assert.deepEqual(stopped.participantIds, current.participantIds)
})

test('manual stop freezes time immediately, independent of saving a recap', () => {
  const stopped = stopGameSession(session(), start + hour)
  assert.equal(stopped.endedAt, at(hour))
  assert.equal(stopped.endReason, 'manual')
  assert.equal(sessionElapsedMilliseconds(stopped, start + 10 * hour), hour)
  assert.equal(stopGameSession(stopped, start + 10 * hour), stopped)
})

test('pauses do not extend the deadline and paused time is not logged as playtime', () => {
  const paused = session({ pausedAt: at(2 * hour), pausedMilliseconds: hour / 2 })
  assert.equal(sessionElapsedMilliseconds(paused, start + 696 * hour), 1.5 * hour)
  const [stopped] = expireGameSessions([paused], start + 696 * hour)
  assert.equal(stopped.endedAt, at(5 * hour))
  assert.equal(stopped.pausedAt, undefined)
  assert.equal(stopped.pausedMilliseconds, 3.5 * hour)
  assert.equal(sessionElapsedMilliseconds(stopped), 1.5 * hour)
  assert.equal(sessionElapsedMilliseconds(stopGameSession(paused, start + 3 * hour)), 1.5 * hour)
})

test('expiration is idempotent, handles all stale timers and preserves completed history', () => {
  const finished = session({ id: 'finished', endedAt: at(8 * hour) })
  const recent = session({ id: 'recent', startedAt: at(9 * hour) })
  const result = expireGameSessions([session(), session({ id: 'other' }), finished, recent], start + 10 * hour)
  assert.equal(result[0].endedAt, at(5 * hour))
  assert.equal(result[1].endedAt, at(5 * hour))
  assert.equal(result[2], finished)
  assert.equal(sessionElapsedMilliseconds(finished), 8 * hour)
  assert.equal(result[3], recent)
  assert.equal(expireGameSessions(result, start + 10 * hour), result)
})

test('calendar no longer auto-starts sessions and the stop control stops before recap', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /autoStartingGameNightRef|options\.automatic|startedAt: tonightEvent\.startAt/)
  assert.match(source, /onFinish=\{stopSession\}/)
  assert.doesNotMatch(source, /Keep timer running|Finish & recap/)
  assert.match(source, /startedAt: createdAt/)
})
