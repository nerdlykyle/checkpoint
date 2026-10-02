import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createManualSession, localDateTimeInput } from '../src/lib/manualSession.ts'
import { expireGameSessions, sessionElapsedMilliseconds } from '../src/lib/sessionTiming.ts'

const now=Date.parse('2026-10-02T18:00:00Z')
const games=[{id:'a',title:'Far Far West',progress:25},{id:'b',title:'LORT',progress:0}]
const crew=[{id:'nern'},{id:'jern'},{id:'vern'}]
const input={gameId:'a',startedAt:'2026-10-01T23:00:00Z',durationMinutes:181,participantIds:['nern','jern','jern','unknown'],note:'  Notes from last night  '}
test('past sessions are completed records with actual selected game, notes and validated players',()=>{
 const session=createManualSession(input,games,crew,'nern',now)
 assert.equal(session.gameTitle,'Far Far West');assert.equal(session.gameId,'a')
 assert.equal(session.startedAt,'2026-10-01T23:00:00.000Z');assert.equal(session.endedAt,'2026-10-02T02:01:00.000Z')
 assert.equal(session.note,'Notes from last night');assert.deepEqual(session.participantIds,['nern','jern'])
 assert.equal(session.recordedManually,true);assert.equal(sessionElapsedMilliseconds(session,now),181*60000)
 assert.equal(session.createdAt,new Date(now).toISOString())
 assert.equal(session.gameNightId,undefined)
})
test('past sessions never start a timer and confirmed history is not capped at the live five-hour limit',()=>{
 const session=createManualSession({...input,durationMinutes:360},games,crew,'nern',now)
 const sessions=[session]
 assert.equal(expireGameSessions(sessions,now),sessions)
 assert.equal(sessionElapsedMilliseconds(session,now),360*60000)
 assert.equal(sessions.some(value=>!value.endedAt),false)
})
test('reject invalid game, time, future ending, invalid players and durations',()=>{
 for(const patch of [{gameId:'missing'},{startedAt:'invalid'},{startedAt:new Date(now).toISOString()},{durationMinutes:0},{durationMinutes:NaN},{durationMinutes:1.5},{durationMinutes:1441},{participantIds:[]},{participantIds:['unknown']},{note:'x'.repeat(5001)}]){
  assert.throws(()=>createManualSession({...input,...patch},games,crew,'nern',now))
 }
 assert.doesNotThrow(()=>createManualSession({...input,startedAt:new Date(now-60000).toISOString(),durationMinutes:1},games,crew,'nern',now))
})
test('date input is formatted in local device time, not truncated UTC',()=>{
 const date=new Date(2026,8,6,19,5)
 assert.equal(localDateTimeInput(date),'2026-09-06T19:05')
})
test('manual-session UI is connected to shared sessions and reversible Activity, not campaign mutations',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 const handler=app.slice(app.indexOf('  function addPastSession('),app.indexOf('  function startSession('))
 assert.match(handler,/setSessions/);assert.match(handler,/recordActivity\('session-added'/)
 assert.match(handler,/entity: 'session'.*after: session/)
 assert.doesNotMatch(handler,/setGames|startSession\(/)
 assert.match(app,/onAddPastSession=\{\(\) => setShowManualSession\(true\)\}/)
})
